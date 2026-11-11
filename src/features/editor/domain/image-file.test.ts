import { describe, expect, it } from "vitest";

import { fitDimensions } from "./image-file";

// Canvas não existe no jsdom: só a matemática pura é testável aqui.
describe("fitDimensions", () => {
  it("reduz proporcionalmente respeitando o lado maior", () => {
    expect(fitDimensions(2560, 1440)).toEqual({ width: 1280, height: 720 });
  });

  it("reduz fotos em retrato pelo lado maior vertical", () => {
    expect(fitDimensions(1440, 2880)).toEqual({ width: 640, height: 1280 });
  });

  it("nunca amplia imagens já pequenas", () => {
    expect(fitDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("usa o mínimo 1px para dimensões frações muito pequenas", () => {
    expect(fitDimensions(2, 1, 1)).toEqual({ width: 1, height: 1 });
  });

  it("deixa dimensões inválidas intactas (guarda)", () => {
    expect(fitDimensions(0, 100)).toEqual({ width: 0, height: 100 });
    expect(fitDimensions(-5, 100)).toEqual({ width: -5, height: 100 });
  });
});
