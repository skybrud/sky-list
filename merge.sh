MODULE_NAME=$(cat ./package.json \
  | grep moduleName \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')

rm -rf ./src/$MODULE_NAME.vue;

cat ./src/$MODULE_NAME.html > ./src/$MODULE_NAME.vue;

echo "\n" >> ./src/$MODULE_NAME.vue;

echo "<style lang=\"scss\">" >> ./src/$MODULE_NAME.vue;
cat ./src/$MODULE_NAME.scss >> ./src/$MODULE_NAME.vue;
echo "</style>" >> ./src/$MODULE_NAME.vue;

echo "\n" >> ./src/$MODULE_NAME.vue;

echo "<script>" >> ./src/$MODULE_NAME.vue;
cat ./src/$MODULE_NAME.js >> ./src/$MODULE_NAME.vue;
echo "</script>" >> ./src/$MODULE_NAME.vue;
