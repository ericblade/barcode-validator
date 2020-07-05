type ReturnType = {
    code: string,
    type: string,
    valid: boolean,
    modifiedCode: string,
};

export default function validate(code: string, type?: string): ReturnType
