/* eslint-disable eqeqeq */
const validationRegex = /^(\d{8,14}|\d{9}[xX])$/;

const toInt = (num) => parseInt(num, 10);

const isOdd = (num) => (num % 2) === 1;

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

// ([ a, b, c, d, e, f, g, h, i, j, k ] * [ 3 1 3 1 3 1 3 1 3 1 3 1 ]) % 10
const getUpcChecksum = generateChecksumCalculator({ evenMult: 1, oddMult: 3, shouldReverse: false });
// ([ a, b, c, d, e, f, g, h, i, j, k, l ] * [ 1 3 1 3 1 3 1 3 1 3 1 3 ]) % 10
const getIsbn13Checksum = generateChecksumCalculator({ evenMult: 3, oddMult: 1, shouldReverse: false })
// ([ l, k, j, i, h, g, f, e, d, c, b, a ] * [ 1 3 1 3 1 3 1 3 1 3 1 3 ]) % 10
const getGtinChecksum = generateChecksumCalculator({ evenMult: 3, oddMult: 1, shouldReverse: true });

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

const validate = (code, type) => {
    // 1980s era UPC codes were apparently 11 digits, not using a checksum. So, if we get 11, I
    // guess there's not much we can do?
    // TODO: we might want to re-architect this so it can pass the corrected UPC back to the caller
    // if (code.length === 11) code = `${code}${getUpcChecksum(code)}`;
    // if (code.length === 11) code = `0${code}`;
    if (code.length === 11) code = `11 digit upc not valid`;
    if (!type) {
        type = (function determineType(t) {
            switch(t.length) {
                case 10: return 'isbn10';
                case 12: return 'upc';
                case 13: {
                    if (code.startsWith('978') || code.startsWith('979') || code.startsWith('290') || code.startsWith('291')) {
                        return 'isbn13';
                    }
                    return 'gtin';
                }
                default: return 'gtin';
            }
        })(code);
    }
    // console.warn('* validating ', code, type);
    if (validationRegex.exec(code) === null) {
        return false;
    }
    if (type === 'gtin') {
        return validGtinChecksum(code);
    }
    if (type === 'upc') {
        return validUpcChecksum(code);
    }
    if (type === 'isbn10') {
        return validIsbn10Checksum(code);
    }
    if (type === 'isbn13') {
        return validIsbn13Checksum(code);
    }
}

// console.warn(validate('092091900451'));
export default validate;
