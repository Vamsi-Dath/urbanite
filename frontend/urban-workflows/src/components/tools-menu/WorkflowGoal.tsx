import React, { useState, useEffect } from "react";
import CSS from "csstype";
import { useLLMContext } from "../../providers/LLMProvider";
import { useFlowContext } from "../../providers/FlowProvider";
import { TrillGenerator } from "../../TrillGenerator";
import { useCode } from "../../hook/useCode";
import { LLMEvents, LLMEventStatus } from "../../constants";
import "./WorkflowGoal.css";

export function WorkflowGoal({ }: { }) {
    const { openAIRequest, llmEvents, consumeEvent, addNewEvent, setCurrentEventPipeline, currentEventPipeline } = useLLMContext();
    const { nodes, edges, workflowNameRef, suggestionsLeft, workflowGoal, updateWarnings, updateSubtasks, setWorkflowGoal, eraseWorkflowSuggestions, flagBasedOnKeyword, cleanCanvas, updateKeywords } = useFlowContext();
    const { loadTrill } = useCode();
    const [isEditing, setIsEditing] = useState(false);
    const [segments, setSegments] = useState<any>([]);
    const [highlights, setHighlights] = useState<any>({});
    const [tooltip, setTooltip] = useState({ visible: false, text: "", x: 0, y: 0, color: "" });
    const [loading, setLoading] = useState(false);
    const [tempWorkflowGoal, setTempWorkflowGoal] = useState(workflowGoal);

    const typeColors: any = {
        Action: "#e6b1b1",
        Dataset: "#b1b5e6",
        Where: "#b1e6c0",
        About: "#e6e6b1",
        Interaction: "#d7b1e6",
        Source: "#e6cdb1",
        Connection: "#e6b1d3",
        Content: "#dedede"
    };

    const generateSuggestion = async (skipConfirmation?: boolean) => {

        let isConfirmed = false;

        if(!skipConfirmation)
            isConfirmed = window.confirm("Are you sure you want to proceed? This will clear your entire board.");
        
        if (isConfirmed || skipConfirmation) {
            setLoading(true);

            cleanCanvas();

            let trill_spec = TrillGenerator.generateTrill(nodes, edges, workflowNameRef.current, workflowGoal);
    
            try {
    
                let result = await openAIRequest("default_preamble", "workflow_suggestions_prompt", "Target dataflow: " + JSON.stringify(trill_spec) + "\n" + "The user goal is: "+workflowGoal+" ");
    
                console.log("generateSuggestion result", result);
    
                let clean_result = result.result.replaceAll("```json", "");
                clean_result = clean_result.replaceAll("```", "");
    
                let parsed_result = JSON.parse(clean_result);
                parsed_result.dataflow.name = workflowNameRef.current;
    
                loadTrill(parsed_result, "workflow");
            } catch (error) {
                console.error("Error communicating with LLM", error);
                alert("Error communicating with LLM");
            } finally {
                setLoading(false);
            }
        }
    }

    const getNewHighlightsBinding = async (nodes: any, edges:any, workflowName: string, workflowGoal: string, current_keywords: any) => {
        let trill_spec = TrillGenerator.generateTrill(nodes, edges, workflowName, workflowGoal);

        let copy_trill = {...trill_spec};

        if(copy_trill.dataflow && copy_trill.dataflow.nodes){
            for(const node of copy_trill.dataflow.nodes){
                if(node.metadata && node.metadata.keywords)
                    delete node.metadata.keywords
            }
        }

        if(copy_trill.dataflow && copy_trill.dataflow.edges){
            for(const edge of copy_trill.dataflow.edges){
                if(edge.metadata && edge.metadata.keywords)
                    delete edge.metadata.keywords
            }
        }

        setLoading(true);

        try {
            let result = await openAIRequest("default_preamble", "keywords_binding_prompt", " Current keywords: " + JSON.stringify(current_keywords) + "\n" + "Trill specification: " + JSON.stringify(trill_spec));

            console.log("getNewHighlightsBinding result", result, workflowGoal);

            let clean_result = result.result.replaceAll("```json", "");
            clean_result = clean_result.replaceAll("```", "");

            let parsed_result = JSON.parse(clean_result);
            parsed_result.dataflow.name = workflowNameRef.current;

            updateKeywords(parsed_result); // Update keywords on the nodes and edges
        } catch (error) {
            console.error("Error communicating with LLM", error);
            alert("Error communicating with LLM");
        } finally {
            setLoading(false);
        }

    }

    const cancelSuggestions = () => {
        eraseWorkflowSuggestions();
    }

    const parseKeywords = async (goal: string) => {
        try {

            if(goal == "")
                return

            let result = await openAIRequest("syntax_analysis_preamble", "syntax_analysis_prompt", goal);

            console.log("parseKeywords result", result);

            let highlights = JSON.parse(result.result);

            const regex = new RegExp(`(${Object.keys(highlights).join("|")})`, "gi");
            const parts = goal.split(regex);

            let highlights_with_index: any = {};

            let keywords = Object.keys(highlights);

            for(let i = 0; i < keywords.length; i++){
                highlights_with_index[keywords[i]] = {
                    type: highlights[keywords[i]],
                    index: i
                };
            }

            setHighlights(highlights_with_index);
            setSegments(parts);

        } catch (error) {
            console.error("Error communicating with LLM", error);
            alert("Error communicating with LLM");
        }
    }

    // Based on the current state of the workflow generates a new task that better reflects what is being done by the user
    const getNewTask = async (current_task: string, current_keywords: any) => {

        try {
            let trill_spec = TrillGenerator.generateTrill(nodes, edges, workflowNameRef.current, workflowGoal);

            let result = await openAIRequest("default_preamble", "task_refresh_prompt", "Current Task: " + current_task + "\n" + " Current keywords: " + JSON.stringify(current_keywords) + "\n" + "Trill specification: " + JSON.stringify(trill_spec));

            console.log("getNewTask result", result);

            setWorkflowGoal(result.result);

        } catch (error) {
            console.error("Error communicating with LLM", error);
            alert("Error communicating with LLM");
        }

    }

    const handleGoalChange = (e: any) => {
        setTempWorkflowGoal(e.target.value);
    };

    const handleNameBlur = () => {
        setIsEditing(false);

        setCurrentEventPipeline("Directly editing a Task");

        if(tempWorkflowGoal != workflowGoal){
            addNewEvent({
                type: LLMEvents.EDIT_TASK,
                status: LLMEventStatus.NOTDONE,
                data: tempWorkflowGoal
            });
        }


    };

    const getNewSubtasks = async (current_task: string) => { // Based on the changes that the user made on the task reflect it to the subtasks

        try {

            if(nodes.length != 0){
                let trill_spec = TrillGenerator.generateTrill(nodes, edges, workflowNameRef.current, current_task);

                let result = await openAIRequest("default_preamble", "new_subtasks_prompt", "Current Task: " + current_task + "\n" + "Trill specification: " + JSON.stringify(trill_spec));
    
                console.log("getNewSubtasks", result);

                let clean_result = result.result.replaceAll("```json", "");
                clean_result = clean_result.replaceAll("```", "");
    
                let parsed_result = JSON.parse(clean_result);
                parsed_result.dataflow.name = workflowNameRef.current;
    
                updateSubtasks(parsed_result);
            }else if(llmEvents.length > 0 && llmEvents[0].type == LLMEvents.GENERATE_NEW_SUBTASK_FROM_TASK && llmEvents[0].status == LLMEventStatus.PROCESSING){
                TrillGenerator.addNewVersionProvenance(nodes, edges, workflowNameRef.current, workflowGoal, currentEventPipeline);
                consumeEvent({type: LLMEvents.GENERATE_HIGHLIGHTS, status: LLMEventStatus.NOTDONE, data: llmEvents[0].data});
            }

        } catch (error) {
            console.error("Error communicating with LLM", error);
            alert("Error communicating with LLM");
        }

    }

    useEffect(() => {

        if(llmEvents.length > 0){
            if(llmEvents[0].type == LLMEvents.GENERATE_NEW_TASK_FROM_SUBTASK && llmEvents[0].status == LLMEventStatus.PROCESSING){ 
                
                TrillGenerator.addNewVersionProvenance(nodes, edges, workflowNameRef.current, workflowGoal, currentEventPipeline);

                consumeEvent({type: LLMEvents.GENERATE_WARNINGS, status: LLMEventStatus.PROCESSING});
                
                generateWarnings(workflowGoal, nodes, edges, workflowNameRef);
            }
        }

    }, [workflowGoal])

    useEffect(() => { 

        if(llmEvents.length > 0){
            if(llmEvents[0].type == LLMEvents.GENERATE_HIGHLIGHTS_RESET && llmEvents[0].status == LLMEventStatus.PROCESSING){ // The highlights generation is done

                consumeEvent({type: LLMEvents.GENERATE_SUGGESTIONS, status: LLMEventStatus.NOTDONE, data: true});

            }else if(llmEvents[0].type == LLMEvents.GENERATE_HIGHLIGHTS && llmEvents[0].status == LLMEventStatus.PROCESSING){

                consumeEvent({type: LLMEvents.BIND_HIGHLIGHTS, status: LLMEventStatus.NOTDONE});

            }
        }

    }, [highlights]) 

    useEffect(() => {
        if(llmEvents.length > 0){
            if((llmEvents[0].type == LLMEvents.GENERATE_HIGHLIGHTS_RESET || llmEvents[0].type == LLMEvents.GENERATE_HIGHLIGHTS) && llmEvents[0].status == LLMEventStatus.NOTDONE){

                let event = {...llmEvents[0]};

                consumeEvent({type: event.type, status: LLMEventStatus.PROCESSING});
                
                setTempWorkflowGoal(event.data);
                parseKeywords(event.data);
                // setTempWorkflowGoal(workflowGoal);
                // parseKeywords(workflowGoal);
            }else if(llmEvents[0].type == LLMEvents.BIND_HIGHLIGHTS && llmEvents[0].status == LLMEventStatus.NOTDONE){
                consumeEvent({type: LLMEvents.BIND_HIGHLIGHTS, status: LLMEventStatus.PROCESSING});
            }else if(llmEvents[0].type == LLMEvents.EDIT_TASK && llmEvents[0].status == LLMEventStatus.NOTDONE){
                consumeEvent({type: LLMEvents.GENERATE_NEW_SUBTASK_FROM_TASK, status: LLMEventStatus.PROCESSING, data: llmEvents[0].data});
            }else if(llmEvents[0].type == LLMEvents.GENERATE_NEW_TASK_FROM_SUBTASK && llmEvents[0].status == LLMEventStatus.NOTDONE){
                consumeEvent({type: LLMEvents.GENERATE_NEW_TASK_FROM_SUBTASK, status: LLMEventStatus.PROCESSING, data: llmEvents[0].data});
            }else if(llmEvents[0].status == LLMEventStatus.DONE){
                consumeEvent();
            }else if(llmEvents[0].type == LLMEvents.GENERATE_NEW_SUBTASK_FROM_TASK && llmEvents[0].status == LLMEventStatus.PROCESSING){
                setWorkflowGoal(tempWorkflowGoal);
                getNewSubtasks(tempWorkflowGoal);
            }else if(llmEvents[0].type == LLMEvents.BIND_HIGHLIGHTS && llmEvents[0].status == LLMEventStatus.PROCESSING){
                getNewHighlightsBinding(nodes, edges, workflowNameRef.current, highlights, workflowGoal);
            }else if(llmEvents[0].type == LLMEvents.GENERATE_NEW_TASK_FROM_SUBTASK && llmEvents[0].status == LLMEventStatus.PROCESSING){
                getNewTask(workflowGoal, highlights);
            }else if((llmEvents[0].type == LLMEvents.GENERATE_SUGGESTIONS) && llmEvents[0].status == LLMEventStatus.NOTDONE){
                consumeEvent({type: LLMEvents.GENERATE_SUGGESTIONS, status: LLMEventStatus.PROCESSING});
                generateSuggestion(llmEvents[0].data);
            }
        }
    }, [llmEvents])

    const generateWarnings = async (goal: string, nodes: any, edges: any, workflowNameRef: any) => {
        try{

            let trill_spec = TrillGenerator.generateTrill(nodes, edges, workflowNameRef.current, workflowGoal);

            console.log("trill_spec", trill_spec);

            let result_warnings = await openAIRequest("default_preamble", "evaluate_coherence_subtasks_prompt", "Task: " + goal + " \n Current Trill: " + JSON.stringify(trill_spec));

            console.log("warnings result", result_warnings);

            let clean_result_warnings = result_warnings.result.replaceAll("```json", "").replaceAll("```python", "");
            clean_result_warnings = clean_result_warnings.replaceAll("```", "");

            let parsed_result_warnings = JSON.parse(clean_result_warnings);

            updateWarnings(parsed_result_warnings);

        }catch(error){
            console.error("Error communicating with LLM", error);
            alert("Error communicating with LLM");
        }
    }

    useEffect(() => {

        if(llmEvents.length > 0){
            if((llmEvents[0].type == LLMEvents.GENERATE_SUGGESTIONS) && llmEvents[0].status == LLMEventStatus.PROCESSING && nodes.length > 0){
                TrillGenerator.addNewVersionProvenance(nodes, edges, workflowNameRef.current, workflowGoal, currentEventPipeline);
                consumeEvent({type: LLMEvents.BIND_HIGHLIGHTS, status: LLMEventStatus.NOTDONE});
            }else if(llmEvents[0].type == LLMEvents.GENERATE_NEW_SUBTASK_FROM_TASK && llmEvents[0].status == LLMEventStatus.PROCESSING){
                TrillGenerator.addNewVersionProvenance(nodes, edges, workflowNameRef.current, workflowGoal, currentEventPipeline);
                consumeEvent({type: LLMEvents.GENERATE_HIGHLIGHTS, status: LLMEventStatus.NOTDONE, data: llmEvents[0].data});
            }else if(llmEvents[0].type == LLMEvents.EDIT_SUBTASK && llmEvents[0].status == LLMEventStatus.NOTDONE){
                consumeEvent({type: LLMEvents.GENERATE_NEW_TASK_FROM_SUBTASK, status: LLMEventStatus.NOTDONE, data: llmEvents[0].data});
            }else if(llmEvents[0].type == LLMEvents.GENERATE_WARNINGS && llmEvents[0].status == LLMEventStatus.PROCESSING){
                consumeEvent({type: LLMEvents.GENERATE_HIGHLIGHTS, status: LLMEventStatus.NOTDONE, data: workflowGoal});
            }else if(llmEvents[0].type == LLMEvents.DELETE_SUBTASK && llmEvents[0].status == LLMEventStatus.NOTDONE){
                consumeEvent({type: LLMEvents.GENERATE_NEW_TASK_FROM_SUBTASK, status: LLMEventStatus.NOTDONE, data: llmEvents[0].data});
            }else if(llmEvents[0].type == LLMEvents.BIND_HIGHLIGHTS && llmEvents[0].status == LLMEventStatus.PROCESSING){
                consumeEvent({type: LLMEvents.BIND_HIGHLIGHTS, status: LLMEventStatus.DONE});
            }
        }

    }, [nodes]);

    const clickGenerateSuggestion = () => {
        if(llmEvents.length > 0){
            alert("Wait a few seconds, we are still processing requests.")
        }else{
            setCurrentEventPipeline("Generating suggestions from Task");

            addNewEvent({
                type: LLMEvents.GENERATE_SUGGESTIONS,
                status: LLMEventStatus.NOTDONE,
                data: false
            });
        }
    }

    return (
        <>
            {/* Editable Workflow Goal */}
            <div style={workflowGoalContainer}>
                
                <div style={{boxShadow: "rgba(0, 0, 0, 0.1) 0px 0px 50px", borderRadius: "4px", width: "800px", overflowY: "auto", height: "200px", padding: "5px", display: "flex", justifyContent: "center", alignItems: "center", scrollbarColor: "#1d3853 transparent"}}>
                    {workflowGoal == "" && !isEditing ?
                        <p style={{marginBottom: "0px", opacity: 0.7, color: "rgb(29, 56, 83)", fontSize: "20px", cursor: "pointer"}} onClick={() => {
                            if(llmEvents.length > 0){
                                alert("Wait a few seconds, we are still processing requests.")
                            }else{
                                setIsEditing(true)
                            }
                        }}>Click here or interact with the LLM to define your task</p> : 
                        <p style={goalStyle} onClick={() => {
                            if(llmEvents.length > 0){
                                alert("Wait a few seconds, we are still processing requests.")
                            }else{
                                setIsEditing(true)
                            }
                        }}>
                            {/* {segments.map((item: any, index: any) => (
                                item
                            ))} */}
                            {isEditing ? 
                                <textarea style={{width: "100%", height: "100%", resize: "none", border: "none", backgroundColor: "rgb(251, 252, 246)", color: "rgb(29, 56, 83)", fontFamily: "Rubik", padding: "10px"}} autoFocus placeholder="Specify your task..." value={tempWorkflowGoal} onChange={handleGoalChange} onBlur={handleNameBlur}></textarea>
                            : 
                                segments.map((part: any, index: any) =>
                                    highlights[part] ? (
                                        <span key={index+"_span_text_goal"} style={{ backgroundColor: typeColors[highlights[part]["type"]], fontWeight: "bold", fontFamily: "Rubik", fontSize: "18px", padding: "2px", marginRight: "4px", borderRadius: "5px", cursor: "default", color: "rgb(29, 56, 83)"}}
                                            onMouseEnter={(e) => {
                                                setTooltip({
                                                    visible: true,
                                                    text: highlights[part]["type"],
                                                    x: e.clientX + 10,
                                                    y: e.clientY + 10,
                                                    color: typeColors[highlights[part]["type"]]
                                                });

                                                flagBasedOnKeyword(highlights[part]["index"]);
                                            }}
                                            onMouseMove={(e) => {
                                                setTooltip(prev => ({ ...prev, x: e.clientX + 10, y: e.clientY + 10, color: typeColors[highlights[part]["type"]]}));
                                            }}
                                            onMouseLeave={(e) => {
                                                setTooltip({ visible: false, text: "", x: 0, y: 0, color: "" });
                                            
                                                flagBasedOnKeyword();
                                            }}
                                        >
                                            {part}
                                            
                                        </span>
                                    ) : (
                                    <span key={index+"_span_text_goal"} style={{fontWeight: "bold", fontFamily: "Rubik", fontSize: "18px", cursor: "default", color: "rgb(29, 56, 83)"}}>{part}</span>
                                    )
                                )}
                        </p>
                    }   
                </div>
                {!loading ?
                    workflowGoal != "" && llmEvents.length == 0 ?
                        suggestionsLeft > 0 ? 
                            <button style={button} onClick={cancelSuggestions}>Cancel suggestions</button> :
                            <button style={button} onClick={clickGenerateSuggestion}>Generate suggestions</button>
                        : null : <button style={button}>...</button>
                }

                {tooltip.visible && (
                    <div style={{...{
                        position: "relative",
                        padding: "5px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        boxShadow: "0px 0px 5px rgba(0,0,0,0.2)",
                        zIndex: 1000
                    }, ...(tooltip.color != "" ? {backgroundColor: tooltip.color} : {})}}>
                        {tooltip.text}
                    </div>
                )}

                
            </div>
        </>

    );
}

const workflowGoalContainer: CSS.Properties = {
    top: "90px",
    textAlign: "center",
    zIndex: 100,
    left: "50%",
    transform: "translateX(-50%)",
    position: "fixed",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "rgb(251, 252, 246)"
};

const goalStyle: CSS.Properties = {
    width: "100%",
    height: "100%",
    fontSize: "16px",
    marginBottom: "0",
    fontWeight: "bold",
    textAlign: "center",
    borderRadius: "4px",
    padding: "5px",
    lineHeight: "1.9"
};

const button: CSS.Properties = {
    backgroundColor: "rgb(29, 56, 83)",
    border: "none",
    color: "rgb(251, 252, 246)",
    fontFamily: "Rubik",
    fontWeight: "bold",
    padding: "6px 10px",
    borderRadius: "5px"
};
 

