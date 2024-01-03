import { Base } from "./Base";
import { Outcome } from "./Outcome";

export class Theme extends Base {
  public name = "Theme";

  protected _fields = [
    { name: "@id", type: "string", primary: true, unique: true, notNull: true },
    { name: "hasName", type: "string", unique: true, notNull: true },
    {
      name: "hasOutcome",
      type: "link",
      link: Outcome,
      unique: false,
      notNull: true,
    },
  ];
}
