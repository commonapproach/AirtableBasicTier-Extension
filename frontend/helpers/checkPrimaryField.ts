import Base from "@airtable/blocks/dist/types/src/models/base";
import { IntlShape } from "react-intl";
import { map, mapSFFModel } from "../domain/models";

export async function checkPrimaryField(base: Base, intl: IntlShape): Promise<string[]> {
	const errors: string[] = [];
	const fullMap = { ...map, ...mapSFFModel };

	for (const table of base.tables) {
		if (!Object.keys(fullMap).includes(table.name)) {
			continue;
		}

		const primaryField = table.primaryField;
		if (primaryField.name !== "@id") {
			errors.push(
				intl.formatMessage(
					{
						id: "validation.messages.invalidPrimaryField",
						defaultMessage: `Table <b>{tableName}</b> must have <b>@id</b> as the primary field.`,
					},
					{ tableName: table.name, b: (str) => `<b>${str}</b>` }
				)
			);
		}
	}

	return errors;
}
