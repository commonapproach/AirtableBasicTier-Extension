import { Base } from "./Base";
import { IndicatorReport } from "./IndicatorReport";

export class Indicator extends Base {
  public name = "Indicator";

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
      name: "hasName",
      type: "string",
      unique: true,
      notNull: true,
      required: true,
    },
    {
      name: "hasDescription",
      type: "text",
      unique: false,
      notNull: false,
      required: false,
    },
    {
      name: "hasIndicatorReport",
      type: "link",
      link: IndicatorReport,
      unique: false,
      notNull: false,
      required: false,
    },
  ];
}
