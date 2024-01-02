import { Base } from "./Base";
import { Outcome } from "./Outcome";

export class Theme extends Base {
  public name = "Theme";

  protected _fields = [
    { name: "@id", type: "string" },
    { name: "hasName", type: "string" },
    { name: "hasOutcome", type: "link", link: Outcome },
  ];
}
