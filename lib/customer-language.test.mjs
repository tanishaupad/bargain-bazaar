import test from "node:test";
import assert from "node:assert/strict";
import { dominantIndicScript, incompatibleSellerLanguage, romanizeCustomerReply } from "./customer-language.ts";

test("native Indic scripts are refused by buyers who do not know them", async () => {
  assert.equal(dominantIndicScript("यह हाथ से बना है, आज ही ले जाइए।"), "Hindi");
  assert.equal(await incompatibleSellerLanguage("यह हाथ से बना है, आज ही ले जाइए।", "Telugu"), "Hindi");
  assert.equal(await incompatibleSellerLanguage("यह हाथ से बना है, आज ही ले जाइए।", "Hinglish"), null);
  assert.equal(await incompatibleSellerLanguage("ఇది చేతితో తయారు చేశారు.", "Bengali"), "Telugu");
  assert.equal(await incompatibleSellerLanguage("Bhaiya, यह बहुत महंगा है, please reduce it.", "Telugu"), "Hindi");
  assert.equal(await incompatibleSellerLanguage("This is a handmade kettle.", "Telugu"), null);
});

test("short borrowed words do not trigger a language refusal", async () => {
  assert.equal(dominantIndicScript("Hello जी, the price is fair."), null);
  assert.equal(await romanizeCustomerReply("This is in English.", "Telugu", null), null);
});
