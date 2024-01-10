import { Base } from "./Base";
import { Indicator } from "./Indicator";
import { IndicatorReport } from "./IndicatorReport";
import { Outcome } from "./Outcome";

export class Organization extends Base {
  public name = "Organization";

  protected _fields = [
    {
      name: "@id",
      type: "string",
      primary: true,
      unique: true,
      notNull: true,
      required: true,
    },
    {
      name: "org:hasLegalName",
      type: "string",
      unique: false,
      notNull: true,
      required: true,
    },
    {
      name: "hasIndicator",
      type: "link",
      link: Indicator,
      unique: false,
      notNull: true,
      required: true,
    },
    {
      name: "hasOutcome",
      type: "link",
      link: Outcome,
      unique: false,
      notNull: true,
      required: true,
    },
    {
      name: "hasIndicator",
      type: "link",
      link: IndicatorReport,
      unique: false,
      notNull: true,
      required: true,
    },
  ];
}
