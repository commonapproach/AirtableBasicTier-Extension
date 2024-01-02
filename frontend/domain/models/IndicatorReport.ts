import { Base } from "./Base";
import { Indicator } from "./Indicator";
import { Organization } from "./Organization";

export class IndicatorReport extends Base {
  public name = "IndicatorReport";

  protected _fields = [
    { name: "@id", type: "string" },
    { name: "hasName", type: "string" },
    { name: "i72:Value", type: "i72" },
    { name: "Comment", type: "string" },
    { name: "forIndicator", type: "link", link: Indicator },
    { name: "forOrganization", type: "link", link: Organization },
  ];
}
