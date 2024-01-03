import { Base } from "./Base";

export class Theme extends Base {
  public name = "Theme";

  protected _fields = [
    { name: "@id", type: "string", primary: true, unique: true, notNull: true },
    { name: "hasName", type: "string", unique: true, notNull: true },
    { name: "hasDescription", type: "text", unique: true, notNull: true },
  ];
}
