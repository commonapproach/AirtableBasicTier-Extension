import { Base } from "./Base";
import { Indicator } from "./Indicator";

export class IndicatorReport extends Base {
  public name = "IndicatorReport";

  protected _fields = [
    { name: "@id", type: "string", primary: true, unique: true, notNull: true },
    { name: "hasName", type: "string", unique: false, notNull: true },
    { name: "hasComment", type: "string", unique: false, notNull: true },
    { name: "value", type: "i72", unique: false, notNull: true },
    { name: "forIndicator", type: "link", link: Indicator, unique: false, notNull: true },
  ];
}
