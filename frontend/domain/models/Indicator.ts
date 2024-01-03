import { Base } from "./Base";
import { IndicatorReport } from "./IndicatorReport";
import { Organization } from "./Organization";
import { Outcome } from "./Outcome";

export class Indicator extends Base {
  public name = "Indicator";

  protected _fields = [
    { name: "@id", type: "string", primary: true, unique: true, notNull: true },
    { name: "hasName", type: "string", unique: false, notNull: true },
    { name: "hasDescription", type: "text", unique: false, notNull: true },
    {
      name: "forOutcome",
      type: "link",
      link: Outcome,
      unique: false,
      notNull: true,
    },
    {
      name: "hasIndicatorReport",
      type: "link",
      link: IndicatorReport,
      unique: false,
      notNull: true,
    },
    {
      name: "Organization",
      type: "link",
      link: Organization,
      unique: false,
      notNull: true,
    },
  ];
}
