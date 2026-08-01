import { shortModel, isCloudModel } from "./model-utils";

describe("shortModel", () => {
  it("elimina el sufijo ':cloud'", () => {
    expect(shortModel("kimi-k2.6:cloud")).toBe("kimi-k2.6");
  });

  it("elimina el sufijo '-cloud' (con guión, sin dos puntos)", () => {
    expect(shortModel("gpt-oss:20b-cloud")).toBe("gpt-oss:20b");
  });

  it("elimina el sufijo ':latest'", () => {
    expect(shortModel("llama3:latest")).toBe("llama3");
  });

  it("deja el modelo intacto si no tiene sufijo conocido", () => {
    expect(shortModel("llama3")).toBe("llama3");
  });
});

describe("isCloudModel", () => {
  it("detecta ':cloud'", () => {
    expect(isCloudModel("kimi-k2.6:cloud")).toBe(true);
  });

  it("detecta '-cloud'", () => {
    expect(isCloudModel("gpt-oss:20b-cloud")).toBe(true);
  });

  it("no marca un modelo local simple como cloud", () => {
    expect(isCloudModel("llama3")).toBe(false);
  });

  it("no marca ':latest' como cloud", () => {
    expect(isCloudModel("llama3:latest")).toBe(false);
  });
});
