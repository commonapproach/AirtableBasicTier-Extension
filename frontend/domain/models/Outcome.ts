import { Base } from "./Base";
import { Indicator } from "./Indicator";
import { Organization } from "./Organization";
import { Theme } from "./Theme";

export class Outcome extends Base {
  public name = "Outcome";

  protected _fields = [
    { name: "@id", type: "string" },
    { name: "hasName", type: "string" },
    { name: "hasDescription", type: "text" },
    { name: "forTheme", type: "link", link: Theme },
    { name: "hasIndicator", type: "link", link: Indicator },
    { name: "Organization", type: "link", link: Organization },
  ];
}
