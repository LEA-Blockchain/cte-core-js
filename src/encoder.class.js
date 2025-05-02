// encoder.class.js
import wasmBinaryEncoder from './encoder.mvp.wasm';

// Import constants from index.js (assuming index.js is in the same directory or adjust path)
// If published, users would import constants from the package root.
import * as CTE from './index.js';

// No module-scoped WASM instance/memory variables anymore

/**
 * @class CteEncoder
 * @classdesc Provides a fluent interface to encode data according to the CTE specification.
 * Each instance manages its own independent WASM encoder module instance and memory.
 * Must be instantiated asynchronously using the static `create` method.
 */
export class CteEncoder {
    #wasmInstance = null;
    #wasmMemory = null;
    #wasmExports = null;
    #encoderHandle = 0; // Pointer to C struct cte_encoder_t*

    /**
     * @private
     * @description Internal constructor. Use static `CteEncoder.create()` method instead.
     * @param {WebAssembly.Instance} wasmInstance - The instantiated encoder WASM module for this object.
     * @param {DataView} wasmMemory - A DataView for this instance's WASM memory.
     * @param {number} encoderHandle - The pointer (handle) to the C encoder context (`cte_encoder_t*`).
     */
    constructor(wasmInstance, wasmMemory, encoderHandle) {
        this.#wasmInstance = wasmInstance;
        this.#wasmMemory = wasmMemory;
        this.#wasmExports = wasmInstance.exports;
        this.#encoderHandle = encoderHandle;
    }

    /**
     * @static
     * @async
     * @description Asynchronously creates and initializes a new, independent CTE encoder instance.
     * Loads and instantiates a fresh copy of the encoder WASM module for this instance.
     * @param {number} capacity - The fixed buffer capacity in bytes for the encoder. Should be large enough for the expected transaction.
     * @returns {Promise<CteEncoder>} A promise that resolves to the initialized CteEncoder instance.
     * @throws {Error} If WASM binary is invalid, instantiation fails, exports are missing, or C-level encoder initialization (`cte_encoder_init`) fails.
     * @example
     * import { CteEncoder } from '@leachain/ctejs-core'; // Use package name
     *
     * async function main() {
     * try {
     * // Each call creates a new WASM instance
     * const encoder1 = await CteEncoder.create(1024);
     * const encoder2 = await CteEncoder.create(2048);
     * console.log('Encoders ready!');
     * } catch (err) {
     * console.error("Failed to create encoder:", err);
     * }
     * }
     * main();
     */
    static async create(capacity) {
        // --- WASM Instantiation moved inside create ---
        const importObject = {
            env: {
                abort: () => {
                    throw new Error(`WASM Encoder aborted`);
                },
            },
        };
        const requiredExports = [
            'memory',
            'get_public_key_size',
            'get_signature_item_size', //
            'cte_encoder_init',
            'cte_encoder_reset',
            'cte_encoder_get_data',
            'cte_encoder_get_size', //
            'cte_encoder_begin_public_key_list',
            'cte_encoder_begin_signature_list', //
            'cte_encoder_write_ixdata_index_reference',
            'cte_encoder_write_ixdata_uleb128', //
            'cte_encoder_write_ixdata_sleb128',
            'cte_encoder_write_ixdata_int8', //
            'cte_encoder_write_ixdata_uint8',
            'cte_encoder_write_ixdata_int16', //
            'cte_encoder_write_ixdata_uint16',
            'cte_encoder_write_ixdata_int32', //
            'cte_encoder_write_ixdata_uint32',
            'cte_encoder_write_ixdata_int64', //
            'cte_encoder_write_ixdata_uint64',
            'cte_encoder_write_ixdata_float32', //
            'cte_encoder_write_ixdata_float64',
            'cte_encoder_write_ixdata_boolean', //
            'cte_encoder_begin_command_data', //
        ];

        // Instantiate a new WASM module for *this* encoder object
        const { instance } = await WebAssembly.instantiate(wasmBinaryEncoder, importObject);
        const memory = new DataView(instance.exports.memory.buffer);

        // Check exports for this instance
        for (const exportName of requiredExports) {
            if (!(exportName in instance.exports)) {
                throw new Error(`WASM Encoder module instance is missing required export: ${exportName}`);
            }
        }
        // --- End WASM Instantiation ---

        const handle = instance.exports.cte_encoder_init(capacity); //
        if (!handle) {
            throw new Error('Failed to create CTE encoder handle in WASM');
        }

        // Create the JS object, passing the specific WASM instance/memory/handle
        return new CteEncoder(instance, memory, handle);
    }

    /**
     * @private
     * @description Refreshes the internal DataView reference to this instance's WASM memory buffer.
     */
    #refreshMemoryView() {
        // Check if the memory buffer associated with *this* instance has changed
        if (this.#wasmMemory.buffer !== this.#wasmInstance.exports.memory.buffer) {
            this.#wasmMemory = new DataView(this.#wasmInstance.exports.memory.buffer);
        }
    }

    /**
     * @description Resets the encoder state for this instance, allowing reuse of its allocated buffer.
     * @returns {this} The encoder instance for chaining.
     * @throws {Error} If the encoder instance handle is invalid (e.g., after destroy).
     */
    reset() {
        if (!this.#encoderHandle) throw new Error('Encoder handle invalid (destroyed?).');
        this.#wasmExports.cte_encoder_reset(this.#encoderHandle); //
        this.#refreshMemoryView();
        return this;
    }

    /**
     * @description Retrieves the currently encoded data from this instance as a byte array.
     * Returns a copy. Terminates an encoding chain.
     * @returns {Uint8Array} A copy of the encoded data bytes.
     * @throws {Error} If the encoder instance handle is invalid or WASM memory access fails.
     */
    getEncodedData() {
        if (!this.#encoderHandle) throw new Error('Encoder handle invalid (destroyed?).');
        const dataPtr = this.#wasmExports.cte_encoder_get_data(this.#encoderHandle); //
        const size = this.#wasmExports.cte_encoder_get_size(this.#encoderHandle); //
        if (!dataPtr && size > 0) {
            throw new Error('WASM get_data returned null pointer but size > 0.');
        }
        if (size === 0) {
            return new Uint8Array(0);
        }
        this.#refreshMemoryView(); // Ensure memory view is current before reading
        if (dataPtr + size > this.#wasmMemory.buffer.byteLength) {
            throw new Error(`WASM memory access error reading encoded data`);
        }
        return new Uint8Array(this.#wasmMemory.buffer.slice(dataPtr, dataPtr + size));
    }

    // --- Size Helpers ---
    /**
     * Gets the expected size in bytes for a signature/hash item based on crypto type code,
     * using this instance's WASM module.
     * @param {number} typeCode - The crypto type code (e.g., `CTE.CTE_CRYPTO_TYPE_ED25519`).
     * @returns {number} The size in bytes.
     * @throws {Error} If the encoder instance handle is invalid or the WASM function returns an invalid size.
     */
    getSignatureItemSize(typeCode) {
        if (!this.#encoderHandle) throw new Error('Encoder not initialized or destroyed.');
        const size = this.#wasmExports.get_signature_item_size(typeCode); //
        if (size <= 0) throw new Error(`WASM get_signature_item_size invalid size (${size}) for type ${typeCode}`);
        return size;
    }
    /**
     * Gets the expected size in bytes for a public key item based on crypto type code,
     * using this instance's WASM module.
     * @param {number} typeCode - The crypto type code (e.g., `CTE.CTE_CRYPTO_TYPE_ED25519`).
     * @returns {number} The size in bytes.
     * @throws {Error} If the encoder instance handle is invalid or the WASM function returns an invalid size.
     */
    getPublicKeySize(typeCode) {
        if (!this.#encoderHandle) throw new Error('Encoder not initialized or destroyed.');
        const size = this.#wasmExports.get_public_key_size(typeCode); //
        if (size <= 0) throw new Error(`WASM get_public_key_size invalid size (${size}) for type ${typeCode}`);
        return size;
    }

    // --- Encoding Methods (Implementations use this.#wasmExports etc.) ---
    /** @private */
    #beginAndWriteListData(beginFuncName, items, typeCode, getWasmItemSizeFunc, listName) {
        if (!this.#encoderHandle) throw new Error('Encoder handle invalid.');
        if (!Array.isArray(items) || items.length < 1 || items.length > CTE.CTE_LIST_MAX_LEN) {
            throw new Error(`Invalid ${listName} list size`);
        } //
        const itemCount = items.length;
        const itemSize = this.#wasmExports[getWasmItemSizeFunc](typeCode); // Call on instance exports
        if (itemSize <= 0) {
            throw new Error(`Invalid ${listName} item size ${itemSize}`);
        }
        const expectedTotalItemSize = itemCount * itemSize;
        const writePtr = this.#wasmExports[beginFuncName](this.#encoderHandle, itemCount, typeCode); //
        if (!writePtr) {
            throw new Error(`Begin ${listName} list failed in WASM`);
        }
        this.#refreshMemoryView();
        if (writePtr + expectedTotalItemSize > this.#wasmMemory.buffer.byteLength) {
            throw new Error(`WASM overflow preparing ${listName}`);
        }
        const memoryBytesView = new Uint8Array(this.#wasmMemory.buffer);
        let currentOffset = writePtr;
        for (const item of items) {
            if (!(item instanceof Uint8Array) || item.length !== itemSize) {
                throw new Error(`Invalid ${listName} item: Expected Uint8Array size ${itemSize}.`);
            }
            memoryBytesView.set(item, currentOffset);
            currentOffset += itemSize;
        }
        return this; // Return this for chaining
    }

    /** @returns {this} */
    addPublicKeyList(keys, typeCode) {
        return this.#beginAndWriteListData(
            'cte_encoder_begin_public_key_list',
            keys,
            typeCode,
            'get_public_key_size',
            'PublicKey'
        );
    } //
    /** @returns {this} */
    addSignatureList(signatures, typeCode) {
        return this.#beginAndWriteListData(
            'cte_encoder_begin_signature_list',
            signatures,
            typeCode,
            'get_signature_item_size',
            'Signature'
        );
    } //

    /** @returns {this} */
    addIxDataIndexReference(index) {
        if (!this.#encoderHandle) throw new Error('Encoder handle invalid.');
        if (
            typeof index !== 'number' ||
            index < 0 ||
            index > CTE.CTE_LEGACY_INDEX_MAX_VALUE ||
            !Number.isInteger(index)
        ) {
            throw new Error(`Invalid legacy index`);
        } //
        this.#wasmExports.cte_encoder_write_ixdata_index_reference(this.#encoderHandle, index); //
        return this;
    }
    /** @private @returns {this} */
    #writeSimpleIxData(fn, v, t, c = null) {
        if (!this.#encoderHandle) throw new Error('Encoder handle invalid.');
        if (c && !c(v)) {
            throw new Error(`Invalid IxData ${t}: Val ${v}`);
        }
        this.#wasmExports[fn](this.#encoderHandle, v);
        return this;
    } //
    /** @returns {this} */
    addIxDataUleb128(v) {
        return this.#writeSimpleIxData(
            'cte_encoder_write_ixdata_uleb128',
            BigInt(v),
            'ULEB128',
            (x) => typeof x === 'bigint' && x >= 0n
        );
    } //
    /** @returns {this} */
    addIxDataSleb128(v) {
        return this.#writeSimpleIxData(
            'cte_encoder_write_ixdata_sleb128',
            BigInt(v),
            'SLEB128',
            (x) => typeof x === 'bigint'
        );
    } //
    /** @returns {this} */
    addIxDataInt8(v) {
        return this.#writeSimpleIxData(
            'cte_encoder_write_ixdata_int8',
            v,
            'Int8',
            (x) => Number.isInteger(x) && x >= -128 && x <= 127
        );
    } //
    /** @returns {this} */
    addIxDataUint8(v) {
        return this.#writeSimpleIxData(
            'cte_encoder_write_ixdata_uint8',
            v,
            'Uint8',
            (x) => Number.isInteger(x) && x >= 0 && x <= 255
        );
    } //
    /** @returns {this} */
    addIxDataInt16(v) {
        return this.#writeSimpleIxData(
            'cte_encoder_write_ixdata_int16',
            v,
            'Int16',
            (x) => Number.isInteger(x) && x >= -32768 && x <= 32767
        );
    } //
    /** @returns {this} */
    addIxDataUint16(v) {
        return this.#writeSimpleIxData(
            'cte_encoder_write_ixdata_uint16',
            v,
            'Uint16',
            (x) => Number.isInteger(x) && x >= 0 && x <= 65535
        );
    } //
    /** @returns {this} */
    addIxDataInt32(v) {
        return this.#writeSimpleIxData(
            'cte_encoder_write_ixdata_int32',
            v,
            'Int32',
            (x) => Number.isInteger(x) && x >= -(2 ** 31) && x <= 2 ** 31 - 1
        );
    } //
    /** @returns {this} */
    addIxDataUint32(v) {
        return this.#writeSimpleIxData(
            'cte_encoder_write_ixdata_uint32',
            v,
            'Uint32',
            (x) => Number.isInteger(x) && x >= 0 && x <= 2 ** 32 - 1
        );
    } //
    /** @returns {this} */
    addIxDataInt64(v) {
        return this.#writeSimpleIxData(
            'cte_encoder_write_ixdata_int64',
            BigInt(v),
            'Int64',
            (x) => typeof x === 'bigint'
        );
    } //
    /** @returns {this} */
    addIxDataUint64(v) {
        return this.#writeSimpleIxData(
            'cte_encoder_write_ixdata_uint64',
            BigInt(v),
            'Uint64',
            (x) => typeof x === 'bigint' && x >= 0n
        );
    } //
    /** @returns {this} */
    addIxDataFloat32(v) {
        return this.#writeSimpleIxData('cte_encoder_write_ixdata_float32', v, 'Float32', (x) => typeof x === 'number');
    } //
    /** @returns {this} */
    addIxDataFloat64(v) {
        return this.#writeSimpleIxData('cte_encoder_write_ixdata_float64', v, 'Float64', (x) => typeof x === 'number');
    } //
    /** @returns {this} */
    addIxDataBoolean(v) {
        return this.#writeSimpleIxData('cte_encoder_write_ixdata_boolean', !!v, 'Boolean');
    } //

    /**
     * Adds a Command Data field. Requires input as `Uint8Array`.
     * @param {Uint8Array} data - The command payload bytes. Length must not exceed `CTE.CTE_COMMAND_EXTENDED_MAX_LEN`.
     * @returns {this} The encoder instance for chaining.
     * @throws {Error} If data is not a `Uint8Array` or exceeds max length, or WASM fails.
     */
    addCommandData(data) {
        // Requires Uint8Array
        if (!this.#encoderHandle) throw new Error('Encoder handle invalid.');
        if (!(data instanceof Uint8Array)) {
            throw new Error('Command data must be a Uint8Array.');
        }
        const bytes = data;
        const len = bytes.length;
        if (len > CTE.CTE_COMMAND_EXTENDED_MAX_LEN) {
            throw new Error(`Cmd data too long: ${len} > ${CTE.CTE_COMMAND_EXTENDED_MAX_LEN}`);
        } //
        const ptr = this.#wasmExports.cte_encoder_begin_command_data(this.#encoderHandle, len); //
        if (!ptr) {
            throw new Error(`Begin command data failed`);
        }
        this.#refreshMemoryView();
        if (ptr + len > this.#wasmMemory.buffer.byteLength) {
            throw new Error(`WASM overflow for Command Data`);
        }
        new Uint8Array(this.#wasmMemory.buffer).set(bytes, ptr);
        return this;
    }

    /**
     * @description Cleans up Javascript references associated with this encoder instance.
     * Does not explicitly free WASM memory. Future calls to this instance will fail.
     */
    destroy() {
        this.#encoderHandle = 0;
        this.#wasmExports = null;
        this.#wasmInstance = null; // Release reference to instance
        this.#wasmMemory = null;
    }
}
