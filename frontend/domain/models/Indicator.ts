import { Base } from "./Base";
import { IndicatorReport } from "./IndicatorReport";
import { Organization } from "./Organization";
import { Outcome } from "./Outcome";

export class Indicator extends Base {
  public name = "Indicator";
  
  protected _fields = [
    { name: "@id", type: "string" },
    { name: "hasName", type: "string" },
    { name: "hasDescription", type: "text" },
    { name: "forOutcome", type: "link", link: Outcome },
    {
      name: "hasIndicatorReport",
      type: "link",
      link: IndicatorReport,
    },
    { name: "Organization", type: "link", link: Organization },
  ];
}
