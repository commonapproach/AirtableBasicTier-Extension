import { Base } from "./Base";
import { Indicator } from "./Indicator";

export class Outcome extends Base {
  public name = "Outcome";

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
      name: "hasDescription",
      type: "text",
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
  ];
}