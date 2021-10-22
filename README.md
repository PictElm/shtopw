## shtopw

### known limitations

possible differences in stderr and stdout; examples:
 * "file not found" error message
 * "echo a b" prints space-separated but "Write-Output a b" will be newline-separated

support of `test` is partial; for example, although it does translate `-o` and `-a` to `-or` and `-and`, logical chaining may just not behave the same:
 * `[ 1 -lt $# ] && [ $# -lt 3 ]`
 * `[ -f "$path" ] && someCommand "$path"`
