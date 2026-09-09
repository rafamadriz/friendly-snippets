.PHONY: check style-check format format-json format-lua

# Run all style checks (same as CI)
check: style-check
style-check:
	prettier --check "**/*.json"
	stylua --check debug/

# Fix all formatting issues
format: format-json format-lua
format-json:
	prettier --write "**/*.json"
format-lua:
	stylua debug/
