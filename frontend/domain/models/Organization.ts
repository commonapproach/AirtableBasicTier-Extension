import { Base } from "./Base";
import { Indicator } from "./Indicator";
import { IndicatorReport } from "./IndicatorReport";
import { Outcome } from "./Outcome";

export class Organization extends Base {
  public name = "Organization";

  protected _fields = [
    { name: "@id", type: "string" },
    { name: "hasLegalName", type: "string" },
    { name: "hasIndicator", type: "link", link: Indicator },
    { name: "hasOutcome", type: "link", link: Outcome },
    { name: "IndicatorReport", type: "link", link: IndicatorReport },
  ];
}
