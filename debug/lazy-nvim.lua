local temp_dir = vim.loop.os_getenv("TEMP") or "/tmp"
local install_dir = temp_dir .. "/lazy-nvim"

-- set stdpaths to use "/tmp/lazy-nvim"
for _, name in ipairs({ "config", "data", "state", "cache" }) do
	vim.env[("XDG_%s_HOME"):format(name:upper())] = install_dir .. "/" .. name
end

-- bootstrap lazy
local lazypath = install_dir .. "/plugins/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
	vim.fn.system({
		"git",
		"clone",
		"--filter=blob:none",
		"--single-branch",
		"https://github.com/folke/lazy.nvim.git",
		lazypath,
	})
end
vim.opt.runtimepath:prepend(lazypath)

-- install plugins
-- modify according to which snippet engine,etc you're using
local plugins = {
	"rafamadriz/friendly-snippets",
	{
		-- snippet engine is necessary to load snippets
		"L3MON4D3/LuaSnip",
		config = function()
			require("luasnip.loaders.from_vscode").load({})
		end,
	},
	{
		-- completion engine is not needed but makes debuggin much easir
		-- since you type and instantly see if snippets are being loaded
		"hrsh7th/nvim-cmp",
		config = function()
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
		end,
	},
	-- cmp completion source for snippets
	"saadparwaiz1/cmp_luasnip",
}
require("lazy").setup(plugins, {
	root = install_dir .. "/plugins",
})

vim.opt.termguicolors = true
