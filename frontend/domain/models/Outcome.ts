import { Base } from "./Base";
import { Indicator } from "./Indicator";

export class Outcome extends Base {
  public name = "Outcome";

  protected _fields = [
    { name: "@id", type: "string", primary: true, unique: true, notNull: true },
    { name: "hasName", type: "string", unique: false, notNull: true },
    { name: "hasDescription", type: "text", unique: false, notNull: true },
    {
      name: "hasIndicator",
      type: "link",
      link: Indicator,
      unique: false,
      notNull: true,
    },
  ];
}
