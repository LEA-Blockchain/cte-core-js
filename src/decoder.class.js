// decoder.class.js
import wasmBinaryDecoder from './decoder.mvp.wasm';

// Import constants from index.js (assuming index.js is in the same directory or adjust path)
import * as CTE from './index.js';

// No module-scoped WASM instance/memory variables anymore

/**
 * @class CteDecoder
 * @classdesc Decodes CTE (Common Transaction Encoding) data using a WASM module.
 * Each instance manages its own independent WASM module instance and memory.
 * Provides methods to peek at upcoming fields and read them sequentially from a loaded buffer.
 * Must be instantiated asynchronously using the static `create` method.
 */
export class CteDecoder {
    #wasmInstance = null;
    #wasmMemory = null;
    #wasmExports = null;
    #decoderHandle = 0; // Pointer to C struct cte_decoder_t*
    #isDestroyed = false;

    /**
     * @private
     * @description Internal constructor. Use static `CteDecoder.create()` method instead.
     * @param {WebAssembly.Instance} wasmInstance - The instantiated decoder WASM module for this object.
     * @param {DataView} wasmMemory - A DataView for this instance's WASM memory.
     * @param {number} decoderHandle - The pointer (handle) to the C decoder context (`cte_decoder_t*`).
     */
    constructor(wasmInstance, wasmMemory, decoderHandle) {
        this.#wasmInstance = wasmInstance;
        this.#wasmMemory = wasmMemory;
        this.#wasmExports = wasmInstance.exports;
        this.#decoderHandle = decoderHandle;
    }

    /**
     * @static
     * @async
     * @description Asynchronously creates and initializes a new, independent CTE decoder instance with the provided data buffer.
     * Loads and instantiates a fresh copy of the decoder WASM module and copies the input buffer into its memory.
     * @param {Uint8Array} cteBuffer - The buffer containing the CTE encoded data. Size must not exceed `CTE.CTE_MAX_TRANSACTION_SIZE`.
     * @returns {Promise<CteDecoder>} A promise that resolves to the initialized CteDecoder instance.
     * @throws {Error} If input is invalid, WASM binary/instantiation fails, exports are missing, buffer size is exceeded, or C-level decoder initialization fails.
     * @example
     * import { CteDecoder } from '@leachain/ctejs-core'; // Use package name
     *
     * async function main(encodedBytes) {
     * try {
     * const decoder = await CteDecoder.create(encodedBytes);
     * console.log('Decoder ready!');
     * // Proceed with decoding...
     * } catch (err) {
     * console.error("Failed to create decoder:", err);
     * }
     * }
     */
    static async create(cteBuffer) {
        if (!(cteBuffer instanceof Uint8Array)) {
            throw new Error('Input must be Uint8Array.');
        }
        if (cteBuffer.length === 0) {
            console.warn('Input buffer empty. WASM might abort.');
        }
        if (cteBuffer.length > CTE.CTE_MAX_TRANSACTION_SIZE) {
            throw new Error(`Input buffer size ${cteBuffer.length} exceeds max ${CTE.CTE_MAX_TRANSACTION_SIZE}`);
        } //

        // --- WASM Instantiation moved inside create ---
        const importObject = {
            env: {
                abort: () => {
                    throw new Error(`WASM Decoder aborted`);
                },
            },
        };
        const requiredExports = [
            'memory',
            'get_public_key_size',
            'get_signature_item_size', //
            'cte_decoder_init',
            'cte_decoder_load',
            'cte_decoder_reset',
            'cte_decoder_peek_tag', //
            'cte_decoder_peek_public_key_list_count',
            'cte_decoder_peek_public_key_list_type', //
            'cte_decoder_read_public_key_list_data',
            'cte_decoder_peek_signature_list_count', //
            'cte_decoder_peek_signature_list_type',
            'cte_decoder_read_signature_list_data', //
            'cte_decoder_read_ixdata_index_reference',
            'cte_decoder_read_ixdata_uleb128', //
            'cte_decoder_read_ixdata_sleb128',
            'cte_decoder_read_ixdata_int8', //
            'cte_decoder_read_ixdata_uint8',
            'cte_decoder_read_ixdata_int16', //
            'cte_decoder_read_ixdata_uint16',
            'cte_decoder_read_ixdata_int32', //
            'cte_decoder_read_ixdata_uint32',
            'cte_decoder_read_ixdata_int64', //
            'cte_decoder_read_ixdata_uint64',
            'cte_decoder_read_ixdata_float32', //
            'cte_decoder_read_ixdata_float64',
            'cte_decoder_read_ixdata_boolean', //
            'cte_decoder_peek_command_data_length',
            'cte_decoder_read_command_data_payload', //
        ];

        // Instantiate a new WASM module for *this* decoder object
        const { instance } = await WebAssembly.instantiate(wasmBinaryDecoder, importObject);
        const memory = new DataView(instance.exports.memory.buffer);

        // Check exports for this instance
        for (const exportName of requiredExports) {
            if (!(exportName in instance.exports)) {
                throw new Error(`WASM Decoder module instance is missing required export: ${exportName}`);
            }
        }
        // --- End WASM Instantiation ---

        const bufferLen = cteBuffer.length;
        const handle = instance.exports.cte_decoder_init(bufferLen); //
        if (!handle) {
            throw new Error('Failed to create decoder handle in WASM');
        }

        const loadPtr = instance.exports.cte_decoder_load(handle); //
        if (!loadPtr) {
            // TODO: Cleanup handle?
            throw new Error('Failed to get load pointer from WASM decoder');
        }

        // Ensure the DataView references the correct, current buffer for *this* instance
        const currentMemoryForInstance = new DataView(instance.exports.memory.buffer);
        if (loadPtr + bufferLen > currentMemoryForInstance.buffer.byteLength) {
            // TODO: Cleanup handle?
            throw new Error(`WASM memory overflow loading data into decoder instance`);
        }
        // Copy input data into *this* decoder's WASM memory
        new Uint8Array(currentMemoryForInstance.buffer).set(cteBuffer, loadPtr);

        // Create the JS object, passing the specific WASM instance/memory/handle
        return new CteDecoder(instance, memory, handle);
    }

    /** @private */
    #checkDestroyed() {
        if (this.#isDestroyed || !this.#decoderHandle) {
            throw new Error('Decoder instance destroyed or handle invalid.');
        }
    }

    /** @private */
    #refreshMemoryView() {
        // Check if the memory buffer associated with *this* instance has changed
        if (this.#wasmMemory.buffer !== this.#wasmInstance.exports.memory.buffer) {
            this.#wasmMemory = new DataView(this.#wasmInstance.exports.memory.buffer);
        }
    }

    /**
     * @description Resets the decoder's read position to the beginning of the loaded buffer for this instance.
     * @throws {Error} If the decoder instance has been destroyed.
     */
    reset() {
        this.#checkDestroyed();
        this.#wasmExports.cte_decoder_reset(this.#decoderHandle);
        this.#refreshMemoryView();
    } //

    /**
     * @description Peeks at the tag (first byte, masked) of the next field in this instance's buffer.
     * @returns {number | null} The tag value (e.g., `CTE.CTE_TAG_PUBLIC_KEY_LIST`) or `null` if at EOF/error.
     * @throws {Error} If the decoder instance has been destroyed.
     */
    peekTag() {
        this.#checkDestroyed();
        const t = this.#wasmExports.cte_decoder_peek_tag(this.#decoderHandle);
        return t < 0 ? null : t;
    } //

    /**
     * @description Peeks at the header of a Public Key List field in this instance's buffer.
     * @returns {{count: number, typeCode: number} | null} Key count and type code, or `null`.
     * @throws {Error} If the decoder instance has been destroyed.
     */
    peekPublicKeyListInfo() {
        this.#checkDestroyed();
        if (this.peekTag() !== CTE.CTE_TAG_PUBLIC_KEY_LIST) return null;
        const c = this.#wasmExports.cte_decoder_peek_public_key_list_count(this.#decoderHandle);
        const t = this.#wasmExports.cte_decoder_peek_public_key_list_type(this.#decoderHandle);
        return c === CTE.CTE_PEEK_EOF || t === CTE.CTE_PEEK_EOF ? null : { count: c, typeCode: t };
    } //

    /**
     * @description Reads and consumes a Public Key List field from this instance's buffer.
     * @returns {Uint8Array | null} A copy of the key data, or `null`.
     * @throws {Error} If read fails, instance destroyed, or memory access fails.
     */
    readPublicKeyListData() {
        this.#checkDestroyed();
        const i = this.peekPublicKeyListInfo();
        if (!i) return null;
        const sz = this.#wasmExports.get_public_key_size(i.typeCode);
        if (sz <= 0) throw new Error(`Invalid PK size ${sz}`); //
        const totSz = i.count * sz;
        const ptr = this.#wasmExports.cte_decoder_read_public_key_list_data(this.#decoderHandle);
        if (!ptr) throw new Error('Read PK fail'); //
        this.#refreshMemoryView();
        if (ptr + totSz > this.#wasmMemory.buffer.byteLength) throw new Error(`PK read overflow`);
        return new Uint8Array(this.#wasmMemory.buffer.slice(ptr, ptr + totSz));
    }

    /**
     * @description Peeks at the header of a Signature List field in this instance's buffer.
     * @returns {{count: number, typeCode: number} | null} Item count and type code, or `null`.
     * @throws {Error} If the decoder instance has been destroyed.
     */
    peekSignatureListInfo() {
        this.#checkDestroyed();
        if (this.peekTag() !== CTE.CTE_TAG_SIGNATURE_LIST) return null;
        const c = this.#wasmExports.cte_decoder_peek_signature_list_count(this.#decoderHandle);
        const t = this.#wasmExports.cte_decoder_peek_signature_list_type(this.#decoderHandle);
        return c === CTE.CTE_PEEK_EOF || t === CTE.CTE_PEEK_EOF ? null : { count: c, typeCode: t };
    } //

    /**
     * @description Reads and consumes a Signature List field from this instance's buffer.
     * @returns {Uint8Array | null} A copy of the signature/hash data, or `null`.
     * @throws {Error} If read fails, instance destroyed, or memory access fails.
     */
    readSignatureListData() {
        this.#checkDestroyed();
        const i = this.peekSignatureListInfo();
        if (!i) return null;
        const sz = this.#wasmExports.get_signature_item_size(i.typeCode);
        if (sz <= 0) throw new Error(`Invalid Sig size ${sz}`); //
        const totSz = i.count * sz;
        const ptr = this.#wasmExports.cte_decoder_read_signature_list_data(this.#decoderHandle);
        if (!ptr) throw new Error('Read Sig fail'); //
        this.#refreshMemoryView();
        if (ptr + totSz > this.#wasmMemory.buffer.byteLength) throw new Error(`Sig read overflow`);
        return new Uint8Array(this.#wasmMemory.buffer.slice(ptr, ptr + totSz));
    }

    /** @private */
    #readSimpleIxData(fn) {
        this.#checkDestroyed();
        if (this.peekTag() !== CTE.CTE_TAG_IXDATA_FIELD) throw new Error('Expected IxData');
        return this.#wasmExports[fn](this.#decoderHandle);
    } //

    /** Reads IxData: Legacy Index Reference (0-15). @returns {number} */
    readIxDataIndexReference() {
        return this.#readSimpleIxData('cte_decoder_read_ixdata_index_reference');
    } //
    /** Reads IxData: ULEB128 encoded value. @returns {bigint} */
    readIxDataUleb128() {
        return BigInt(this.#readSimpleIxData('cte_decoder_read_ixdata_uleb128'));
    } //
    /** Reads IxData: SLEB128 encoded value. @returns {bigint} */
    readIxDataSleb128() {
        return BigInt(this.#readSimpleIxData('cte_decoder_read_ixdata_sleb128'));
    } //
    /** Reads IxData: Fixed int8. @returns {number} */
    readIxDataInt8() {
        return this.#readSimpleIxData('cte_decoder_read_ixdata_int8');
    } //
    /** Reads IxData: Fixed uint8. @returns {number} */
    readIxDataUint8() {
        return this.#readSimpleIxData('cte_decoder_read_ixdata_uint8');
    } //
    /** Reads IxData: Fixed int16. @returns {number} */
    readIxDataInt16() {
        return this.#readSimpleIxData('cte_decoder_read_ixdata_int16');
    } //
    /** Reads IxData: Fixed uint16. @returns {number} */
    readIxDataUint16() {
        return this.#readSimpleIxData('cte_decoder_read_ixdata_uint16');
    } //
    /** Reads IxData: Fixed int32. @returns {number} */
    readIxDataInt32() {
        return this.#readSimpleIxData('cte_decoder_read_ixdata_int32');
    } //
    /** Reads IxData: Fixed uint32. @returns {number} */
    readIxDataUint32() {
        return this.#readSimpleIxData('cte_decoder_read_ixdata_uint32');
    } //
    /** Reads IxData: Fixed int64. @returns {bigint} */
    readIxDataInt64() {
        return BigInt(this.#readSimpleIxData('cte_decoder_read_ixdata_int64'));
    } //
    /** Reads IxData: Fixed uint64. @returns {bigint} */
    readIxDataUint64() {
        return BigInt(this.#readSimpleIxData('cte_decoder_read_ixdata_uint64'));
    } //
    /** Reads IxData: Fixed float32. @returns {number} */
    readIxDataFloat32() {
        return this.#readSimpleIxData('cte_decoder_read_ixdata_float32');
    } //
    /** Reads IxData: Fixed float64. @returns {number} */
    readIxDataFloat64() {
        return this.#readSimpleIxData('cte_decoder_read_ixdata_float64');
    } //
    /** Reads IxData: Boolean constant. @returns {boolean} */
    readIxDataBoolean() {
        return !!this.#readSimpleIxData('cte_decoder_read_ixdata_boolean');
    } //

    /**
     * @description Peeks at the header of Command Data in this instance's buffer.
     * @returns {number | null} The payload length, or `null`.
     * @throws {Error} If the decoder instance has been destroyed.
     */
    peekCommandDataLength() {
        this.#checkDestroyed();
        if (this.peekTag() !== CTE.CTE_TAG_COMMAND_DATA) return null;
        const l = this.#wasmExports.cte_decoder_peek_command_data_length(this.#decoderHandle);
        return l < 0 || l > CTE.CTE_COMMAND_EXTENDED_MAX_LEN ? null : l;
    } //

    /**
     * @description Reads and consumes a Command Data field payload from this instance's buffer.
     * @returns {{data: Uint8Array} | null} An object containing the payload bytes as `data`, or `null`.
     * @throws {Error} If read fails, instance destroyed, or memory access fails.
     */
    readCommandDataPayload() {
        // Enforces Uint8Array only return
        this.#checkDestroyed();
        const len = this.peekCommandDataLength();
        if (len === null || len < 0) return null;
        const ptr = this.#wasmExports.cte_decoder_read_command_data_payload(this.#decoderHandle);
        if (!ptr && len > 0) throw new Error('Read Cmd payload failed'); //
        let data = new Uint8Array(0);
        if (len > 0) {
            this.#refreshMemoryView();
            if (ptr + len > this.#wasmMemory.buffer.byteLength) throw new Error(`Cmd read overflow`);
            data = new Uint8Array(this.#wasmMemory.buffer.slice(ptr, ptr + len));
        }
        return { data }; // Return only data
    }

    /**
     * @description Cleans up Javascript references associated with this decoder instance.
     * Does not explicitly free WASM memory. Future calls to this instance will fail.
     */
    destroy() {
        this.#decoderHandle = 0;
        this.#wasmExports = null;
        this.#wasmInstance = null; // Release reference to instance
        this.#wasmMemory = null;
        this.#isDestroyed = true;
    }
}
