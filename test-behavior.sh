TEST_CASE_START_LINE="--------------------------------------------------"
TEST_RESULT="[result]"
TEST_DIR="test-behavior"
TEST_LOG_FILE="$TEST_DIR/$TEST_DIR.log"
TEST_FAILED=0
TEST_YAML_FILE="$TEST_DIR/test.yaml"
OTHER_FILE_NAME="other-name"

# テストのログを記録する関数
start_test_case() {
    CASE_FAILED=0
    local test_case_no="$1"
    local test_case="$2"
    local expected="$3"

    mkdir -p $TEST_DIR/$test_case_no
    echo "$TEST_CASE_START_LINE" >> $TEST_LOG_FILE 2>&1
    echo "[case] $test_case_no : $test_case" >> $TEST_LOG_FILE 2>&1
    echo "[expected] $expected" >> $TEST_LOG_FILE 2>&1
}

# ファイルの存在を確認する関数
# 存在しない場合、TEST_FAILEDを1に変更する
# 
# Arguments:
#   $1(string): チェック対象のファイルパス
# Returns:
#   0: 正常終了
#   1: ファイルが存在しない
assert_exists_file() {
    local file1="$1"
    if [ ! -f "$file1" ]; then
        echo "$TEST_RESULT NG($file1 is not created)" >> $TEST_LOG_FILE 2>&1
        CASE_FAILED=1
        TEST_FAILED=1
        return 1
    else
        return 0
    fi
}

# ファイルが存在しないことを確認する関数
# 存在する場合、TEST_FAILEDを1に変更する
# 
# Arguments:
#   $1(string): チェック対象のファイルパス
# Returns:
#   0: 正常終了
#   1: ファイルが存在しない
assert_not_exists_file() {
    local file1="$1"
    if [ -f "$file1" ]; then
        echo "$TEST_RESULT NG($file1 is not created)" >> $TEST_LOG_FILE 2>&1
        CASE_FAILED=1
        TEST_FAILED=1
        return 1
    else
        return 0
    fi
}

end_test_case() {
  if (( CASE_FAILED == 0 )); then
    echo "  => ✅ Case PASSED" >> $TEST_LOG_FILE 2>&1
  else
    echo "  => ❌ Case FAILED" >> $TEST_LOG_FILE 2>&1
  fi
}

# before process
## cleanup
rm -rf $TEST_DIR
mkdir -p $TEST_DIR
cp -f test/fixtures/all-features.yaml $TEST_YAML_FILE

# main process
echo "**************************************************" > $TEST_LOG_FILE 2>&1
echo "behavior test" > $TEST_LOG_FILE 2>&1
echo "**************************************************" > $TEST_LOG_FILE 2>&1

echo "start test" > $TEST_LOG_FILE 2>&1

TEST_CASE="case1"
start_test_case $TEST_CASE "no parameter" "show help"
npm run render >> $TEST_LOG_FILE 2>&1

TEST_CASE="case2-1"
start_test_case $TEST_CASE "short help parameter" "show help"
npm run render -- -h >> $TEST_LOG_FILE 2>&1

TEST_CASE="case2-2"
start_test_case $TEST_CASE "help parameter" "show help"
npm run render -- -help >> $TEST_LOG_FILE 2>&1

TEST_CASE="case3"
start_test_case $TEST_CASE "input parameter only" "output image(to same directory)"
    npm run render -- $TEST_YAML_FILE >> $TEST_LOG_FILE 2>&1
    mv $TEST_DIR/test.png $TEST_DIR/$TEST_CASE/test.png
    mv $TEST_DIR/test.svg $TEST_DIR/$TEST_CASE/test.svg
    assert_exists_file $TEST_DIR/$TEST_CASE/test.png
    assert_exists_file $TEST_DIR/$TEST_CASE/test.svg
end_test_case

TEST_CASE="case4-1"
start_test_case $TEST_CASE "input and output(file) parameter" "output image(to root directory, specified name)"
    npm run render -- $TEST_YAML_FILE --out $OTHER_FILE_NAME >> $TEST_LOG_FILE 2>&1
    mv $OTHER_FILE_NAME.png $TEST_DIR/$TEST_CASE/$OTHER_FILE_NAME.png
    mv $OTHER_FILE_NAME.svg $TEST_DIR/$TEST_CASE/$OTHER_FILE_NAME.svg
    assert_exists_file $TEST_DIR/$TEST_CASE/$OTHER_FILE_NAME.png
    assert_exists_file $TEST_DIR/$TEST_CASE/$OTHER_FILE_NAME.svg
end_test_case

TEST_CASE="case4-2"
start_test_case $TEST_CASE "input and output(directory and file) parameter" "output image(to specified directory)"
    npm run render -- $TEST_YAML_FILE --out $TEST_DIR/$TEST_CASE/$OTHER_FILE_NAME >> $TEST_LOG_FILE 2>&1
    assert_exists_file $TEST_DIR/$TEST_CASE/$OTHER_FILE_NAME.png
    assert_exists_file $TEST_DIR/$TEST_CASE/$OTHER_FILE_NAME.svg
end_test_case

TEST_CASE="case4-3"
start_test_case $TEST_CASE "input, output and outputType parameter" "output image(svg)"
    npm run render -- $TEST_YAML_FILE --out $TEST_DIR/$TEST_CASE/$OTHER_FILE_NAME --out-type svg >> $TEST_LOG_FILE 2>&1
    assert_not_exists_file $TEST_DIR/$TEST_CASE/$OTHER_FILE_NAME.png
    assert_exists_file $TEST_DIR/$TEST_CASE/$OTHER_FILE_NAME.svg
end_test_case

TEST_CASE="case4-4"
start_test_case $TEST_CASE "input, output and outputType parameter" "output image(png)"
    npm run render -- $TEST_YAML_FILE --out $TEST_DIR/$TEST_CASE/$OTHER_FILE_NAME --out-type png >> $TEST_LOG_FILE 2>&1
    assert_exists_file $TEST_DIR/$TEST_CASE/$OTHER_FILE_NAME.png
    assert_not_exists_file $TEST_DIR/$TEST_CASE/$OTHER_FILE_NAME.svg
end_test_case

echo "end test" >> $TEST_LOG_FILE 2>&1

if [ "$TEST_FAILED" -ne 0 ]; then
    exit 1
fi
