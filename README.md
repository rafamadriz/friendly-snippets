# Friendly Snippets

Snippets collection for a set of different programming languages for faster development.

The only goal is to have one community driven repository for all kinds of
snippets in all programming languages, this way you can have it all in one
place.

### Usage

This collection of snippets should work with any plugin that supports loading
vscode snippets. Like for example:

- [vim-vsnip](https://github.com/hrsh7th/vim-vsnip)
- [LuaSnip](https://github.com/L3MON4D3/LuaSnip)
- [coc-snippets](https://github.com/neoclide/coc-snippets)

### Add snippets from a framework to a filetype.

There's extra snippets included in this repo but they are not added by default,
since it would be irrelevant for people not using those frameworks. See
[`snippets/frameworks`](https://github.com/rafamadriz/friendly-snippets/tree/main/snippets/frameworks)

For example: if you want to add rails snippets to ruby.

With LuaSnip:

```lua
require'luasnip'.filetype_extend("ruby", {"rails"})
```

This method is going to work globally on all open buffers with `ruby` filetype.
Alternatively you can do `set filetype=ruby.rails` so it only works on a
specific buffer, but this is going to mess up with syntax highlighting.

With vim-vsnip:

```viml
let g:vsnip_filetypes.ruby = ['rails']
```

For more info related to this change see [#88](https://github.com/rafamadriz/friendly-snippets/issues/88)

### Install

Use your plugin manager of choice, e.g.

```lua
-- Packer
use "rafamadriz/friendly-snippets"

-- Plug
Plug 'rafamadriz/friendly-snippets'

-- If you're using coc.nvim, you can use:
CocInstall https://github.com/rafamadriz/friendly-snippets@main
```

#### HTML

![HTML gif](https://user-images.githubusercontent.com/67771985/131255337-d53f3408-b60d-44a2-93ba-9a3240a7436e.gif)

#### JS

![JS gif](https://user-images.githubusercontent.com/67771985/131255342-e393165a-e4b1-401e-9084-a782b9dd3fef.gif)

##### NOTE: Using [nvim-compe](https://github.com/hrsh7th/nvim-compe) with [vim-vsnip](https://github.com/hrsh7th/vim-vsnip) on the videos.

## TODO

- Add all included snippets to the
  [Wiki](https://github.com/rafamadriz/friendly-snippets/wiki).

## Thanks to all contributors

<a href="https://github.com/rafamadriz/friendly-snippets/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=rafamadriz/friendly-snippets" />
</a>

## Credits

A good portion of the snippets have been forked from the following repositories:

- [vscode-standardjs-snippets](https://github.com/capaj/vscode-standardjs-snippets)
- [python-snippets](https://github.com/cstrap/python-snippets)
- [vs-snippets](https://github.com/kitagry/vs-snippets)
- [Wscats/html-snippets](https://github.com/Wscats/html-snippets)
- [Harry-Ross/vscode-c-snippets](https://github.com/Harry-Ross/vscode-c-snippets)
- [vscode-jekyll-snippets](https://github.com/edheltzel/vscode-jekyll-snippets)
- [vscode-fortran-support](https://github.com/krvajal/vscode-fortran-support)
- [vscode_cobol](https://github.com/spgennard/vscode_cobol)
- [VSCode-LaTeX-Snippets](https://github.com/JeffersonQin/VSCode-LaTeX-Snippets)
- [vscode-react-javascript-snippets](https://github.com/dsznajder/vscode-react-javascript-snippets)
- [honza/vim-snippets - Verilog](https://github.com/honza/vim-snippets/blob/master/snippets/verilog.snippets)
