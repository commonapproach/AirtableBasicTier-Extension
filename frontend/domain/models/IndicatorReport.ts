import { Base } from "./Base";
import { Indicator } from "./Indicator";

export class IndicatorReport extends Base {
  public name = "IndicatorReport";

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
      unique: false,
      notNull: true,
      required: true,
    },
    {
      name: "hasComment",
      type: "string",
      unique: false,
      notNull: false,
      required: false,
    },
    {
      name: "value",
      type: "i72",
      unique: false,
      notNull: true,
      required: true,
    },
    {
      name: "forIndicator",
      type: "link",
      link: Indicator,
      unique: false,
      notNull: true,
      required: true,
    },
  ];
}
