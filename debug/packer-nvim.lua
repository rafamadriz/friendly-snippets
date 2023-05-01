local on_windows = vim.loop.os_uname().version:match("Windows")

local function join_paths(...)
	local path_sep = on_windows and "\\" or "/"
	local result = table.concat({ ... }, path_sep)
	return result
end

vim.cmd([[set runtimepath=$VIMRUNTIME]])

local temp_dir = vim.loop.os_getenv("TEMP") or "/tmp"

vim.cmd("set packpath=" .. join_paths(temp_dir, "packer-nvim", "site"))

local package_root = join_paths(temp_dir, "packer-nvim", "site", "pack")
local install_path = join_paths(package_root, "packer", "start", "packer.nvim")
local compile_path = join_paths(install_path, "plugin", "packer_compiled.lua")

-- install plugins
-- modify according to which snippet engine,etc you're using
local function load_plugins()
	require("packer").startup({
		{
			"wbthomason/packer.nvim",
			"rafamadriz/friendly-snippets",
			"L3MON4D3/LuaSnip", -- snippet engine is necessary to load snippets
			-- completion engine is not needed but makes debuggin much easir
			-- since you type and instantly see if snippets are being loaded
			"hrsh7th/nvim-cmp",
			"saadparwaiz1/cmp_luasnip", -- cmp completion source for snippets
		},
		config = {
			package_root = package_root,
			compile_path = compile_path,
		},
	})
end

_G.load_config = function()
	local cmp = require("cmp")

	cmp.setup({
		snippet = {
			expand = function(args)
				require("luasnip").lsp_expand(args.body)
			end,
		},
		mapping = cmp.mapping.preset.insert({
			["<C-b>"] = cmp.mapping.scroll_docs(-4),
			["<C-f>"] = cmp.mapping.scroll_docs(4),
			["<C-Space>"] = cmp.mapping.complete(),
			["<C-e>"] = cmp.mapping.abort(),
			["<CR>"] = cmp.mapping.confirm({ select = true }),
		}),
		sources = cmp.config.sources({
			{ name = "luasnip" },
		}),
	})

	require("luasnip.loaders.from_vscode").load({})
end

if vim.fn.isdirectory(install_path) == 0 then
	vim.fn.system({ "git", "clone", "https://github.com/wbthomason/packer.nvim", install_path })
	load_plugins()
	require("packer").sync()
	vim.cmd([[autocmd User PackerComplete ++once lua load_config()]])
else
	load_plugins()
	require("packer").sync()
	_G.load_config()
end
