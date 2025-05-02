# @leachain/cte-core

[![NPM Version](https://img.shields.io/npm/v/@leachain/cte-core)](https://www.npmjs.com/package/@leachain/cte-core)
Javascript library for encoding and decoding data using the Common Transaction Encoding (CTE) format, powered by independent WebAssembly instances for encoder and decoder.

## Features

* Provides `CteEncoder` and `CteDecoder` classes.
* Fluent chaining API for encoding.
* Strict `Uint8Array` interface for command data.
* Each encoder/decoder object manages its own WASM instance for isolation.

## Installation

```bash
npm install @leachain/cte-core
````

## Prerequisites

  * **WASM Support:** Your Javascript environment (Node.js \>= 22.15 or modern Browsers) must support WebAssembly.

## Basic Usage

```javascript
import { CteEncoder, CteDecoder, CTE_CRYPTO_TYPE_ED25519 } from '@leachain/cte-core';

// TextEncoder might be needed in user code to prepare data
const textEncoder = new TextEncoder();

async function example() {
  let encoder;
  let decoder;
  try {
    encoder = await CteEncoder.create(1024);
    const keys = [ new Uint8Array(32).fill(1) ];
    const cmdBytes = textEncoder.encode("My Data");

    const encodedData = await encoder
      .addPublicKeyList(keys, CTE_CRYPTO_TYPE_ED25519)
      .addIxDataIndexReference(0)
      .addIxDataInt32(999)
      .addCommandData(cmdBytes)
      .getEncodedData();

    console.log(`Encoded ${encodedData.length} bytes.`);
    encoder.destroy(); // Clean up encoder resources

    // Decode it
    decoder = await CteDecoder.create(encodedData);
    const tag = decoder.peekTag();
    // ... continue decoding steps ...
    console.log('Decoded successfully (basic check).');
    decoder.destroy(); // Clean up decoder resources

  } catch (err) {
    console.error("CTE Example Error:", err);
    // Ensure cleanup on error
    if (encoder) encoder.destroy();
    if (decoder) decoder.destroy();
  }
}

example();
```

## API Documentation

For detailed information on all classes, methods, constants, and types, please refer to the **[API Documentation](https://lea-blockchain.github.io/cte-core-js)**.

## Notes

  * **WASM Instances:** Each call to `CteEncoder.create()` or `CteDecoder.create()` instantiates a new, independent WASM module. Call `.destroy()` on instances when finished to release references.
  * **Error Handling:** The underlying C/WASM code uses `abort()` for fatal errors (e.g., buffer overflow, invalid parameters). Ensure your application environment handles potential WASM traps.

## Copyright

This LIP is licensed under the MIT License, in alignment with the main [LEA Project](https://getlea.org) License.
