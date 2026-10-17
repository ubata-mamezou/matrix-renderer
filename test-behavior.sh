TEST_CASE_START_LINE="--------------------------------------------------"
TEST_CASE="[case]"
TEST_EXPECTED="[expected]"
TEST_RESULT="[result]"
TEST_DIR="test-behavior"
TEST_LOG_FILE="$TEST_DIR/$TEST_DIR.log"
TEST_FAILED=0

# テストのログを記録する関数
start_test_case() {
    local test_case="$1"
    local expected="$2"

    echo "$TEST_CASE_START_LINE" >> $TEST_LOG_FILE 2>&1
    echo "$TEST_CASE $test_case" >> $TEST_LOG_FILE 2>&1
    echo "$TEST_EXPECTED $expected" >> $TEST_LOG_FILE 2>&1
}

# ファイルの存在を確認する関数
assert_exists_file() {
    local file1="$1"
    local file2="$2"
    if [ ! -f "$file1" ]; then
        echo "$TEST_RESULT NG($file1 is not created)" >> $TEST_LOG_FILE 2>&1
        TEST_FAILED=1
        return 1
    elif [ ! -f "$file2" ]; then
        echo "$TEST_RESULT NG($file2 is not created)" >> $TEST_LOG_FILE 2>&1
        TEST_FAILED=1
        return 1
    else
        echo "$TEST_RESULT OK" >> $TEST_LOG_FILE 2>&1
        return 0
    fi
}

# before process
TEST_YAML_FILE="$TEST_DIR/test.yaml"
OTHER_FILE_NAME="other-name"

## cleanup
rm -rf $TEST_DIR/case3
rm -rf $TEST_DIR/case4-1
rm -rf $TEST_DIR/case4-2

## create test env
mkdir -p $TEST_DIR
mkdir -p $TEST_DIR/case3
mkdir -p $TEST_DIR/case4-1
mkdir -p $TEST_DIR/case4-2
cp -f test/fixtures/all-features.yaml $TEST_YAML_FILE

# main process
echo "**************************************************" > $TEST_LOG_FILE 2>&1
echo "behavior test" > $TEST_LOG_FILE 2>&1
echo "**************************************************" > $TEST_LOG_FILE 2>&1

echo "start test" > $TEST_LOG_FILE 2>&1

start_test_case "1. no parameter" "show help"
npm run render >> $TEST_LOG_FILE 2>&1

start_test_case "2-1. short help parameter" "show help"
npm run render -- -h >> $TEST_LOG_FILE 2>&1

start_test_case "2-2. help parameter" "show help"
npm run render -- -help >> $TEST_LOG_FILE 2>&1

start_test_case "3. input parameter only" "output image(to same directory)"
npm run render -- $TEST_YAML_FILE >> $TEST_LOG_FILE 2>&1
mv $TEST_DIR/test.png $TEST_DIR/case3/test.png
mv $TEST_DIR/test.svg $TEST_DIR/case3/test.svg
assert_exists_file $TEST_DIR/case3/test.png $TEST_DIR/case3/test.svg

start_test_case "4-1. input and output(file) parameter" "output image(to root directory, specified name)"
npm run render -- $TEST_YAML_FILE --out $OTHER_FILE_NAME >> $TEST_LOG_FILE 2>&1
mv $OTHER_FILE_NAME.png $TEST_DIR/case4-1/$OTHER_FILE_NAME.png
mv $OTHER_FILE_NAME.svg $TEST_DIR/case4-1/$OTHER_FILE_NAME.svg
assert_exists_file $TEST_DIR/case4-1/other-name.png $TEST_DIR/case4-1/other-name.svg

start_test_case "4-2. input and output(directory and file) parameter" "output image(to specified directory)"
npm run render -- $TEST_YAML_FILE --out $TEST_DIR/case4-2/$OTHER_FILE_NAME >> $TEST_LOG_FILE 2>&1
assert_exists_file $TEST_DIR/case4-2/$OTHER_FILE_NAME.png $TEST_DIR/case4-2/$OTHER_FILE_NAME.svg

echo "end test" >> $TEST_LOG_FILE 2>&1

if [ "$TEST_FAILED" -ne 0 ]; then
    exit 1
fi
