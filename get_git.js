import { execSync } from 'child_process';
try {
  console.log(execSync('git show HEAD:src/components/CronogramaView.tsx | grep -B 5 -A 200 "row mappings"').toString());
} catch(e){
  console.log(e.toString());
}
