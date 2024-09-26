import { Base } from "./Base";

export class OrganizationType extends Base {
	static className = "OrganizationType";

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
				name: "instance",
				type: "string",
				representedType: "string",
				defaultValue: "",
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
		];
	}
}
