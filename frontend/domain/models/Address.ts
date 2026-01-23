import { Base } from "./Base";

export class Address extends Base {
	static className: string = "Address";

	constructor() {
		super();
		this._fields = [
			{
				name: "@id",
				type: "string",
				representedType: "string",
				primary: true,
				unique: true,
				notNull: true,
				required: true,
				semiRequired: false,
			},
			{
				name: "streetAddress",
				type: "text",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: false,
				required: true,
				semiRequired: false,
			},
			{
				name: "extendedAddress",
				type: "string",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: false,
				required: false,
				semiRequired: false,
			},
			{
				name: "addressLocality",
				type: "string",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: false,
				required: false,
				semiRequired: false,
			},
			{
				name: "addressRegion",
				type: "string",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: false,
				required: false,
				semiRequired: false,
			},
			{
				name: "postalCode",
				type: "string",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: false,
				required: false,
				semiRequired: false,
			},
			{
				name: "addressCountry",
				type: "string",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: false,
				required: false,
				semiRequired: false,
			},
			{
				name: "postOfficeBoxNumber",
				type: "string",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: false,
				required: false,
				semiRequired: false,
			},
		];
	}
}
