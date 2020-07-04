// Useful information: GTIN13 and EAN are basically the same thing.
// TODO: should also be functions to convert between UPC and EAN.
// TODO: need to also return 978 and 979 versions of 290 and 291 series ISBN barcodes.

/* eslint-disable eqeqeq */
const validationRegex = /^(\d{8,14}|\d{9}[xX])$/;

const toInt = (num) => parseInt(num, 10);

const isOdd = (num) => (num % 2) === 1;

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

// all of the supported barcode types have their checksum digit as the last digit of the string.
const extractCheckDigit = (code) => {
    const str = code.toString().toUpperCase();
    return str[str.length - 1];
};

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

function getTypeOfBarcode(code) {
    console.warn('*getTypeOfBarcode', code, typeof code);
    switch(code.length) {
        case 10: return 'isbn10';
        case 12: return 'upc';
        case 13: {
            if(/^(978|979|290|291)[0-9].*/.match(code)) {
                return 'isbn13';
            }
            return 'gtin';
        }
        default: return 'gtin';
    }
}

const validatorMap = {
    gtin: validGtinChecksum,
    upc: validUpcChecksum,
    isbn10: validIsbn10Checksum,
    isbn13: validIsbn13Checksum,
};

// Given a barcode and an optional type, will attempt to correct an invalid code in some possible ways,
// and return if the code was valid.  If a type is NOT provided, type will be inferred (see getTypeOfBarcode())
// and returned.  If you DO specify a type, *only* validation on that type will be performed.
// Therefore, if your application *requires* a ISBN, pass the type.  If your application doesn't care what
// kind, or wants to know what kind it is, then don't pass the type.
// From the return value, you probably want to make use of the modifiedCode value, as that will contain
// the barcode that was actually validated -- ancient UPC codes pre-12 digit usage will be modified,
// and the modifiedCode value will in the future contain the 978/979 version of 290/291 ISBNs.  In short,
// if you pass in something that is an error, but *can* be fixed, it will be contained in the modifiedCode
// return value.

const validate = (code, type) => {
    // 1980s era UPC codes were apparently 11 digits, not using a checksum. So, if we get 11, I
    // guess there's not much we can do besides pass it with a 0 prefixing it and hope it works.
    const modifiedCode = code.length === 11 ? `0${code}` : code;
    if (!type) {
        type = getTypeOfBarcode(modifiedCode);
    }
    // console.warn('* validating ', code, modifiedCode, type);
    if (validationRegex.exec(modifiedCode) === null) {
        return false;
    }
    const valid = validatorMap[type](modifiedCode);
    return {
        code,
        type,
        valid,
        modifiedCode,
    }
}

console.warn(validate('092091900451'));
console.warn(validate('92091900451'));
console.warn(validate('0083717201410'));
export default validate;
