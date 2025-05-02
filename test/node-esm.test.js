import {
    CteEncoder,
    CteDecoder,
    CTE_TAG_PUBLIC_KEY_LIST,
    CTE_TAG_SIGNATURE_LIST,
    CTE_TAG_IXDATA_FIELD,
    CTE_TAG_COMMAND_DATA,
    CTE_CRYPTO_TYPE_ED25519,
    CTE_CRYPTO_TYPE_SLH_DSA_128F,
    CTE_PUBKEY_SIZE_ED25519,
} from '@leachain/cte-core';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: false });

function printHex(label, u8arr) {
    const hex = Array.from(u8arr)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
    console.log(`${label} (${u8arr.length} bytes): ${hex || '<EMPTY>'}`);
}

async function runTest() {
    console.log('--- CTE JS Test Start ---');
    const capacity = 2048;

    let encoder = null;
    let decoder = null;

    try {
        console.log('Encoding...');
        encoder = await CteEncoder.create(capacity);
        console.log('Encoder created.');

        const keys = [new Uint8Array(CTE_PUBKEY_SIZE_ED25519).fill(0xaa)];

        const sigSize = encoder.getSignatureItemSize(CTE_CRYPTO_TYPE_SLH_DSA_128F);

        const sigs = [new Uint8Array(sigSize).fill(0xbb)];
        const cmdDataBytes = textEncoder.encode('Hello CTE World!');

        const encodedBytes = encoder
            .addPublicKeyList(keys, CTE_CRYPTO_TYPE_ED25519)
            .addIxDataIndexReference(0)
            .addSignatureList(sigs, CTE_CRYPTO_TYPE_SLH_DSA_128F)
            .addIxDataIndexReference(0)
            .addIxDataUleb128(123456n)
            .addIxDataSleb128(-987n)
            .addIxDataInt32(1000000)
            .addIxDataUint64(12345678901234567890n)
            .addIxDataFloat32(1.618)
            .addIxDataBoolean(true)
            .addIxDataBoolean(false)
            .addCommandData(cmdDataBytes)
            .getEncodedData();

        printHex('Encoded Data', encodedBytes);
        console.log('Encoding Complete.');
        encoder.destroy();
        encoder = null;

        console.log('\nDecoding...');
        decoder = await CteDecoder.create(encodedBytes);
        console.log('Decoder created.');

        let fieldCount = 0;
        const decodedItems = [];

        while (true) {
            const tag = decoder.peekTag();
            if (tag === null) {
                console.log('Decoding complete (EOF reached).');
                break;
            }
            fieldCount++;
            console.log(`\nField ${fieldCount}: Tag 0x${tag.toString(16)}`);

            try {
                switch (tag) {
                    case CTE_TAG_PUBLIC_KEY_LIST: {
                        const info = decoder.peekPublicKeyListInfo();
                        console.log('  Type: PK List', info);
                        const data = decoder.readPublicKeyListData();
                        printHex('  Data', data);
                        decodedItems.push({ type: 'PKList', count: info.count, typeCode: info.typeCode, data });
                        break;
                    }
                    case CTE_TAG_SIGNATURE_LIST: {
                        const info = decoder.peekSignatureListInfo();
                        console.log('  Type: Sig List', info);
                        const data = decoder.readSignatureListData();
                        printHex('  Data', data);
                        decodedItems.push({ type: 'SigList', count: info.count, typeCode: info.typeCode, data });
                        break;
                    }
                    case CTE_TAG_IXDATA_FIELD: {
                        let ixData;
                        if (fieldCount === 2)
                            ixData = { subType: 'IndexRef', value: decoder.readIxDataIndexReference() };
                        else if (fieldCount === 4)
                            ixData = { subType: 'IndexRef', value: decoder.readIxDataIndexReference() };
                        else if (fieldCount === 5) ixData = { subType: 'ULEB128', value: decoder.readIxDataUleb128() };
                        else if (fieldCount === 6) ixData = { subType: 'SLEB128', value: decoder.readIxDataSleb128() };
                        else if (fieldCount === 7) ixData = { subType: 'Int32', value: decoder.readIxDataInt32() };
                        else if (fieldCount === 8) ixData = { subType: 'Uint64', value: decoder.readIxDataUint64() };
                        else if (fieldCount === 9) ixData = { subType: 'Float32', value: decoder.readIxDataFloat32() };
                        else if (fieldCount === 10) ixData = { subType: 'Boolean', value: decoder.readIxDataBoolean() };
                        else if (fieldCount === 11) ixData = { subType: 'Boolean', value: decoder.readIxDataBoolean() };
                        else {
                            throw new Error(`Unexpected IxData at field ${fieldCount}`);
                        }
                        console.log(`  Type: IxData (${ixData.subType}), Value: ${ixData.value}`);
                        decodedItems.push({ type: 'IxData', ...ixData });
                        break;
                    }
                    case CTE_TAG_COMMAND_DATA: {
                        const len = decoder.peekCommandDataLength();
                        console.log(`  Type: Command Data (len ${len})`);
                        const cmdResult = decoder.readCommandDataPayload();
                        if (cmdResult) {
                            printHex('  Raw Data', cmdResult.data);
                            try {
                                const decodedText = textDecoder.decode(cmdResult.data);
                                console.log('  Decoded Text (in test):', decodedText);
                            } catch {
                                console.log('  Raw Data (not valid UTF-8)');
                            }
                            decodedItems.push({ type: 'CommandData', length: len, data: cmdResult.data });
                        } else {
                            console.log('  Failed to read command data payload');
                            break;
                        }
                        break;
                    }
                    default:
                        throw new Error(`Unknown field tag 0x${tag.toString(16)}`);
                }
            } catch (readError) {
                console.error(`Error reading field ${fieldCount}:`, readError);
                break;
            }
        }

        if (decoder) {
            decoder.destroy();
            decoder = null;
        }
    } catch (error) {
        console.error('--- CTE JS Test FAILED ---:', error);
        if (encoder) encoder.destroy();
        if (decoder) decoder.destroy();
    } finally {
        console.log('--- CTE JS Test End ---');
    }
}

runTest();
