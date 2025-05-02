/** @description Common Transaction Encoding (CTE) Version Byte (v1). Value: `0xF1`. */
export const CTE_VERSION_BYTE = 0xf1;

/**
 * @description Maximum allowed size in bytes for a complete encoded CTE transaction.
 * @type {number}
 */
export const CTE_MAX_TRANSACTION_SIZE = 1232;

// --- Field Tags ---
/** @description Field Tag Mask (Top 2 bits). Value: `0xC0`. */
export const CTE_TAG_MASK = 0xc0;
/** @description Field Tag: Identifies a Public Key List. Value: `0x00`. */
export const CTE_TAG_PUBLIC_KEY_LIST = 0x00; // 00xxxxxx
/** @description Field Tag: Identifies a Signature List. Value: `0x40`. */
export const CTE_TAG_SIGNATURE_LIST = 0x40; // 01xxxxxx
/** @description Field Tag: Identifies an IxData Field. Value: `0x80`. */
export const CTE_TAG_IXDATA_FIELD = 0x80; // 10xxxxxx
/** @description Field Tag: Identifies Command Data. Value: `0xC0`. */
export const CTE_TAG_COMMAND_DATA = 0xc0; // 11xxxxxx

// --- Crypto Types ---
/** @description Crypto Type Mask (Lowest 2 bits). Value: `0x03`. */
export const CTE_CRYPTO_TYPE_MASK = 0x03;
/** @description Crypto Type: Ed25519 signature scheme. Value: `0x00`. */
export const CTE_CRYPTO_TYPE_ED25519 = 0x00;
/** @description Crypto Type: SLH-DSA-SHA2-128f Post-Quantum scheme. Value: `0x01`. */
export const CTE_CRYPTO_TYPE_SLH_DSA_128F = 0x01;
/** @description Crypto Type: SLH-DSA-SHA2-192f Post-Quantum scheme. Value: `0x02`. */
export const CTE_CRYPTO_TYPE_SLH_DSA_192F = 0x02;
/** @description Crypto Type: SLH-DSA-SHA2-256f Post-Quantum scheme. Value: `0x03`. */
export const CTE_CRYPTO_TYPE_SLH_DSA_256F = 0x03;

// --- Sizes ---
/** @description Max number of items in a Public Key or Signature List. Value: `15`. */
export const CTE_LIST_MAX_LEN = 15; //
/** @description Ed25519 Public Key Size in bytes. Value: `32`. */
export const CTE_PUBKEY_SIZE_ED25519 = 32; //
/** @description SLH-DSA-128f Public Key Size in bytes. Value: `32`. */
export const CTE_PUBKEY_SIZE_SLH_128F = 32; //
/** @description SLH-DSA-192f Public Key Size in bytes. Value: `48`. */
export const CTE_PUBKEY_SIZE_SLH_192F = 48; //
/** @description SLH-DSA-256f Public Key Size in bytes. Value: `64`. */
export const CTE_PUBKEY_SIZE_SLH_256F = 64; //
/** @description Ed25519 Signature Size in bytes. Value: `64`. */
export const CTE_SIGNATURE_SIZE_ED25519 = 64; //
/** @description Size in bytes of the hash used for SLH-DSA Signatures. Value: `32`. */
export const CTE_SIGNATURE_HASH_SIZE_PQC = 32; //

// --- IxData Subtypes ---
/** @description IxData Subtype Mask (Lowest 2 bits). Value: `0x03`. */
export const CTE_IXDATA_SUBTYPE_MASK = 0x03;
/** @description IxData Subtype: Legacy Index Reference (0-15). Value: `0x00`. */
export const CTE_IXDATA_SUBTYPE_LEGACY_INDEX = 0x00; //
/** @description IxData Subtype: Variable Length Integer (Varint). Value: `0x01`. */
export const CTE_IXDATA_SUBTYPE_VARINT = 0x01; //
/** @description IxData Subtype: Fixed Size Data Type. Value: `0x02`. */
export const CTE_IXDATA_SUBTYPE_FIXED = 0x02; //
/** @description IxData Subtype: Constant Value (True/False). Value: `0x03`. */
export const CTE_IXDATA_SUBTYPE_CONSTANT = 0x03; //

// --- IxData Varint Encodings ---
/** @description IxData Varint Encoding: Represents the value 0. Value: `0x00`. */
export const CTE_IXDATA_VARINT_ENC_ZERO = 0x00;
/** @description IxData Varint Encoding: Unsigned LEB128 follows. Value: `0x01`. */
export const CTE_IXDATA_VARINT_ENC_ULEB128 = 0x01; //
/** @description IxData Varint Encoding: Signed LEB128 follows. Value: `0x02`. */
export const CTE_IXDATA_VARINT_ENC_SLEB128 = 0x02; //

// --- IxData Fixed Data Types ---
/** @description IxData Fixed Type: Signed 8-bit integer. Value: `0x00`. */
export const CTE_IXDATA_FIXED_TYPE_INT8 = 0x00; //
/** @description IxData Fixed Type: Signed 16-bit integer. Value: `0x01`. */
export const CTE_IXDATA_FIXED_TYPE_INT16 = 0x01; //
/** @description IxData Fixed Type: Signed 32-bit integer. Value: `0x02`. */
export const CTE_IXDATA_FIXED_TYPE_INT32 = 0x02; //
/** @description IxData Fixed Type: Signed 64-bit integer. Value: `0x03`. */
export const CTE_IXDATA_FIXED_TYPE_INT64 = 0x03; //
/** @description IxData Fixed Type: Unsigned 8-bit integer. Value: `0x04`. */
export const CTE_IXDATA_FIXED_TYPE_UINT8 = 0x04; //
/** @description IxData Fixed Type: Unsigned 16-bit integer. Value: `0x05`. */
export const CTE_IXDATA_FIXED_TYPE_UINT16 = 0x05; //
/** @description IxData Fixed Type: Unsigned 32-bit integer. Value: `0x06`. */
export const CTE_IXDATA_FIXED_TYPE_UINT32 = 0x06; //
/** @description IxData Fixed Type: Unsigned 64-bit integer. Value: `0x07`. */
export const CTE_IXDATA_FIXED_TYPE_UINT64 = 0x07; //
/** @description IxData Fixed Type: 32-bit Floating Point (float). Value: `0x08`. */
export const CTE_IXDATA_FIXED_TYPE_FLOAT32 = 0x08; //
/** @description IxData Fixed Type: 64-bit Floating Point (double). Value: `0x09`. */
export const CTE_IXDATA_FIXED_TYPE_FLOAT64 = 0x09; //

// --- IxData Constant Values ---
/** @description IxData Constant Value: Represents boolean `false`. Value: `0x00`. */
export const CTE_IXDATA_CONST_VAL_FALSE = 0x00; //
/** @description IxData Constant Value: Represents boolean `true`. Value: `0x01`. */
export const CTE_IXDATA_CONST_VAL_TRUE = 0x01; //

/** @description Max value for a Legacy Index Reference. Value: `15`. */
export const CTE_LEGACY_INDEX_MAX_VALUE = 15; //

// --- Command Data ---
/** @description Command Data Format Flag Mask (Bit 5). Value: `0x20`. */
export const CTE_COMMAND_FORMAT_FLAG_MASK = 0x20;
/** @description Command Data Format: Short (Length 0-31). Value: `0x00`. */
export const CTE_COMMAND_FORMAT_SHORT = 0x00; //
/** @description Command Data Format: Extended (Length 32-1197). Value: `0x20`. */
export const CTE_COMMAND_FORMAT_EXTENDED = 0x20; //
/** @description Max length for Command Data using the short format. Value: `31`. */
export const CTE_COMMAND_SHORT_MAX_LEN = 31; //
/** @description Max practical length for Command Data using the extended format. Value: `1197`. */
export const CTE_COMMAND_EXTENDED_MAX_LEN = 1197; //

/** @description Value returned by decoder peek functions on EOF/error. Value: `0xFF`. */
export const CTE_PEEK_EOF = 0xff; // From decoder.h

// Re-export classes
export { CteEncoder } from './encoder.class.js';
export { CteDecoder } from './decoder.class.js';
