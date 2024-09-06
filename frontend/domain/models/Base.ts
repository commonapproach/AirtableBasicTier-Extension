export class Base {
	protected _fields: FieldType[];
	public getFieldByName(name: string): FieldType {
		return this.getAllFields().find((field) => {
			if (field.name === name) return true;
			if (field.name.includes(":")) {
				return field.name.split(":")[1] === name;
			}
			return false;
		});
	}

	public getTopLevelFields(): FieldType[] {
		return this._fields;
	}

	public getAllFields(): FieldType[] {
		const fields = [];
		for (const field of this._fields) {
			fields.push(field);
			if (field.type === "object") {
				fields.push(...this.getFieldsRecursive(field.properties));
			}
		}
		return fields;
	}

	private getFieldsRecursive(fields: FieldType[]): FieldType[] {
		const result = [];
		for (const field of fields) {
			result.push(field);
			if (field.type === "object") {
				result.push(...this.getFieldsRecursive(field.properties));
			}
		}
		return result;
	}
}

export type FieldType = {
	name: string;
	type: FieldTypes;
	objectType?: string;
	defaultValue?: any;
	representedType: string;
	displayName?: string;
	properties?: FieldType[];
	primary?: boolean;
	unique?: boolean;
	notNull?: boolean;
	link?: { table: any; field: string };
	selectOptions?: string[];
	required: boolean;
	semiRequired: boolean;
};

export type FieldTypes =
	| "string"
	| "text"
	| "link"
	| "object"
	| "date"
	| "datetime"
	| "select"
	| "boolean";
