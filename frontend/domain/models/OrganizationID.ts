import { Base } from "./Base";
import { CorporateRegistrar } from "./CorporateRegistrar";
import { Organization } from "./Organization";

export class OrganizationID extends Base {
	static className: string = "OrganizationID";

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
				name: "forOrganization",
				type: "link",
				representedType: "string",
				defaultValue: "",
				link: { table: Organization, field: "hasID" },
				unique: false,
				notNull: false,
				required: false,
				semiRequired: true,
			},
			{
				name: "hasIdentifier",
				type: "string",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: false,
				required: false,
				semiRequired: true,
			},
			{
				name: "issuedBy",
				type: "link",
				representedType: "string",
				defaultValue: "",
				link: { table: CorporateRegistrar, field: "issuedOrganizationID" },
				unique: false,
				notNull: false,
				required: false,
				semiRequired: true,
			},
		];
	}
}
