rem Download last version of original vscode snippets from different sources
rem JEKYLL
mkdir snippets\jekyll
wget --output-document=snippets/jekyll/vscode-jekyll-snippets.json https://raw.githubusercontent.com/edheltzel/vscode-jekyll-snippets/master/snippets/jekyll.json

rem FORTRAN
mkdir snippets\fortran
wget --output-document=snippets/fortran/vscode-fortran-support.json https://raw.githubusercontent.com/krvajal/vscode-fortran-support/master/snippets/fortran90.json

rem COBOL
mkdir snippets\cobol
wget --output-document=snippets/cobol/vscode_cobol-compound.json https://raw.githubusercontent.com/spgennard/vscode_cobol/main/snippets/cobol-compound.json

mkdir snippets\cobol
wget --output-document=snippets/cobol/vscode_cobol.json https://raw.githubusercontent.com/spgennard/vscode_cobol/main/snippets/cobol.json

mkdir snippets\cobol
wget --output-document=snippets/cobol/vscode_cobol_dir.json https://raw.githubusercontent.com/spgennard/vscode_cobol/main/snippets/dir.json

mkdir snippets\cobol
wget --output-document=snippets/cobol/vscode_cobol_jcl.json https://raw.githubusercontent.com/spgennard/vscode_cobol/main/snippets/jcl.json

rem LATEX
mkdir snippets\latex
wget --output-document=snippets/latex/vscode-latex-snippets.json https://raw.githubusercontent.com/JeffersonQin/VSCode-LaTeX-Snippets/master/snippets/latex.json

mkdir snippets\latex
wget --output-document=snippets/latex/vscode-latex-support.json https://raw.githubusercontent.com/AREA44/vscode-LaTeX-support/main/snippets/LaTeX.json

mkdir snippets\latex
wget --output-document=snippets/latex/latex-snippets.json https://raw.githubusercontent.com/sabertazimi/LaTeX-snippets/master/snippets/snippets.json
