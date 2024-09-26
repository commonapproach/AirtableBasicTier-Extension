import { Base } from "./Base";

export class Characteristic extends Base {
	static className = "Characteristic";

	constructor() {
		super();
		this._fields = [
			{
				name: "@id",
				type: "string",
				representedType: "string",
				primary: true,
				unique: false,
				notNull: true,
				required: false,
				semiRequired: true,
			},
			{
				name: "hasName",
				type: "string",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: true,
				required: false,
				semiRequired: true,
			},
			{
				name: "hasValue",
				type: "string",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: false,
				required: false,
				semiRequired: true,
			},
			{
				name: "hasCode",
				type: "string",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: false,
				required: false,
				semiRequired: true,
			},
		];
	}
}
