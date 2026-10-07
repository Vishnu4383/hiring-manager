from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

class Task(BaseModel):
    id: int
    name: str
    completed: bool

class NewTask(BaseModel):
    name: str

class EditTask(BaseModel):
    name: Optional[str] = None
    completed: Optional[bool] = None

tasks=[]

@app.get("/")
def root():
    return {"message": "To Do Lists"}

@app.get("/tasks",response_model=list[Task])
def get_all_tasks(completed: Optional[bool]=None):
    if completed is None:
        return tasks
    result=[]
    for task in tasks:
        if task["completed"] == completed:
            result.append(task)
    return result

@app.get("/tasks/{task_id}",response_model=Task)
def get_task(task_id: int):
    for task in tasks:
        if task["id"]==task_id:
            return task
    raise HTTPException(status_code=404,detail="Task not found")

@app.post("/tasks",response_model=Task,status_code=status.HTTP_201_CREATED)
def add_new_task(task: NewTask):
    id=len(tasks)+1
    new_task={
        "id": id,
        "name": task.name,
        "completed": False
    }
    tasks.append(new_task)
    return new_task

@app.patch("/tasks/{task_id}",response_model=Task)
def task_edit(edits: EditTask,task_id: int):
    for task in tasks:
        if task_id == task['id']:
            changes=edits.model_dump(exclude_unset=True)
            if "name" in changes:
                task["name"]=changes["name"]
            if "completed" in changes:
                task["completed"]=changes["completed"]
            if not changes:
                task["completed"]=True
            return task
    raise HTTPException(status_code=404, detail="Task not found")

@app.delete("/tasks/{task_id}",status_code=status.HTTP_204_NO_CONTENT)
def task_remove(task_id: int):
    for task in tasks:
        if task_id == task["id"]:
            tasks.remove(task)
            return
    raise HTTPException(status_code=404,detail="Task not found")