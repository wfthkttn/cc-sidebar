{
  description = "sidebar: an always-on Claude Code sidebar of tool icons with badges and drawers";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      # the plugin directory alone, at share/sidebar: Claude Code loads the .ts as is
      packages.${system}.default = pkgs.stdenvNoCC.mkDerivation {
        pname = "sidebar";
        version = "0.1.0";
        src = self;
        dontBuild = true;
        installPhase = ''
          mkdir -p $out/share/sidebar
          cp -r .claude-plugin hooks types $out/share/sidebar/
        '';
      };
    };
}
