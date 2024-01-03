import { Base } from "./Base";
import { Indicator } from "./Indicator";
import { Organization } from "./Organization";

export class IndicatorReport extends Base {
  public name = "IndicatorReport";

  protected _fields = [
    { name: "@id", type: "string", primary: true, unique: true, notNull: true },
    { name: "hasName", type: "string", unique: false, notNull: true },
    { name: "i72:Value", type: "i72", unique: false, notNull: true },
    { name: "Comment", type: "string", unique: false, notNull: true },
    { name: "forIndicator", type: "link", link: Indicator, unique: false, notNull: true },
    { name: "forOrganization", type: "link", link: Organization, unique: false, notNull: true },
  ];
}
