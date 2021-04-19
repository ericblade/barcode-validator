const { toInt, isOdd, extractCheckDigit } = require('./util');

// generates a checksum calculator.  The various checksums we support are all generated in similar
// fashion, just using some slightly different parameters.  In UPC, odd numbers are multiplied by 3,
// in GTIN and ISBN, the even numbers are multiplied by 3.  The difference between ISBN and GTIN checksums
// is that GTIN checksums are calculated from last digit to first, instead of first to last.
// Therefore, we have 3 function parameters: evenMult, oddMult, and shouldReverse.  The formulae are
// otherwise identical between UPC, GTIN, and ISBN.  This may also be true for other types of barcodes,
// but I have not studied those, as these are the most commonly used ones in the United States, where I am
// located. -Eric
// The returned function takes a string containing numbers from 0-9, and calculates a checksum value.
// Note that it does NOT validate that the length of the string is valid -- it returns a checksum based
// on the entire string given to it, it needs to be up to other functions to determine if the length
// is valid or not.
// Note also that ISBN10, which contains "X" as a valid character, has a completely different checksum
// routine, below.
const generateChecksumCalculator = ({ evenMult, oddMult, shouldReverse }) => {
    return (str) => {
        // parseInt makes sure the entire string is an int, but if the first char is a '0',
        // then it strips it, oops.
        // TODO: we need to verify the same thing with ISBNs that end in "X".
        const chunks = parseInt(str).toString().split('').map(toInt);
        if (str.startsWith('0')) chunks.unshift(0);
        const parseChunks = shouldReverse ? chunks.reverse() : chunks;
        if (shouldReverse) parseChunks.shift();
        else parseChunks.pop();

        let checksum = parseChunks.reduce((acc, n, i) => {
            acc += isOdd(i) ? n * evenMult : n * oddMult;
            return acc;
        }, 0);

        checksum %= 10;
        return (checksum === 0) ? 0 : (10 - checksum);
    }
};

// create the UPC, ISBN13, and GTIN checksum generators.
// ([ a, b, c, d, e, f, g, h, i, j, k ] * [ 3 1 3 1 3 1 3 1 3 1 3 1 ]) % 10
const getUpcChecksum = generateChecksumCalculator({ evenMult: 1, oddMult: 3, shouldReverse: false });
// ([ a, b, c, d, e, f, g, h, i, j, k, l ] * [ 1 3 1 3 1 3 1 3 1 3 1 3 ]) % 10
const getIsbn13Checksum = generateChecksumCalculator({ evenMult: 3, oddMult: 1, shouldReverse: false })
// ([ l, k, j, i, h, g, f, e, d, c, b, a ] * [ 1 3 1 3 1 3 1 3 1 3 1 3 ]) % 10
const getGtinChecksum = generateChecksumCalculator({ evenMult: 3, oddMult: 1, shouldReverse: true });

// ([ a, b, c, d, e, f, g, h, i ] * [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]) % 11
const validIsbn10Checksum = (isbn) => {
    const chunks = parseInt(isbn).toString().split('').map(toInt);
    if (extractCheckDigit(isbn) === 'X') {
        chunks.push(10);
    }
    if (isbn.startsWith('0')) {
        chunks.unshift(0);
    }
    // console.warn('* chunks=', chunks);
    const check = chunks.reduce((acc, n, i) => {
        acc += (n * (i + 1));
        return acc;
    }, 0);
    return (check % 11) === 0;
};

const validUpcChecksum = (upc) => {
    const check = extractCheckDigit(upc);
    // console.warn('* check digit=', check);
    return getUpcChecksum(upc) == check || getGtinChecksum(upc) == check;
}

const validGtinChecksum = (gtin) => {
    const check = extractCheckDigit(gtin);
    return getGtinChecksum(gtin) == check;
}

const validIsbn13Checksum = (isbn) => {
    const check = extractCheckDigit(isbn);
    return getIsbn13Checksum(isbn) == check;
}

module.exports = {
    getIsbn13Checksum,
    validGtinChecksum,
    validUpcChecksum,
    validIsbn10Checksum,
    validIsbn13Checksum,
}
