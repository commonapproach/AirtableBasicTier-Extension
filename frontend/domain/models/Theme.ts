import { Base } from "./Base";

export class Theme extends Base {
  public name = "Theme";

  protected _fields = [
    {
      name: "@id",
      type: "string",
      representedType: "string",
      primary: true,
      unique: true,
      notNull: true,
      required: true,
      semiRequired: false,
    },
    {
      name: "hasName",
      type: "string",
      representedType: "string",
      unique: true,
      notNull: true,
      required: true,
      semiRequired: false,
    },
    {
      name: "hasDescription",
      type: "text",
      representedType: "string",
      defaultValue: "",
      unique: false,
      notNull: false,
      required: false,
      semiRequired: false,
    },
  ];
}
