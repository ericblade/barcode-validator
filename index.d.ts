type ReturnType = {
    code: string,
    type: 'asin' | 'isbn10' | 'upc' | 'isbn13' | 'gtin' | 'unknown',
    valid: boolean,
    modifiedCode: string,
};

export default function validate(code: string, type?: string): ReturnType
