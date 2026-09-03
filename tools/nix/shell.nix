{ pkgs ? import <nixpkgs> { } }:

pkgs.mkShellNoCC {
  packages = with pkgs; [
    nodejs
    pnpm
  ];
}
