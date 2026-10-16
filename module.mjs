// @ts-check
import { module } from "@prisma/composer";
import myProjectService from "./service.mjs";
import myProject2Service from "./.research/source/service.mjs";
import myProject3Service from "./.research/source/.archive-inspect/unpacked/service.mjs";
import myProject4Service from "./.research/source/.archive-inspect/unpacked/.nexmonie-source/unpacked/nexMonie/service.mjs";

export default module("nex-moni", ({ provision }) => {
  provision(myProjectService, { id: "myproject" });
  provision(myProject2Service, { id: "myproject2" });
  provision(myProject3Service, { id: "myproject3" });
  provision(myProject4Service, { id: "myproject4" });
});
