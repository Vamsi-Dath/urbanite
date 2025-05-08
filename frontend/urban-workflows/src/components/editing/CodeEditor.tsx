import React, { useState, useEffect, useRef } from "react";

// Bootstrap
import Button from "react-bootstrap/Button";
import "bootstrap/dist/css/bootstrap.min.css";
import { BoxType, SupportedType } from "../../constants";

// Editor
import Editor from "@monaco-editor/react";
import { useFlowContext } from "../../providers/FlowProvider";
import { useProvenanceContext } from "../../providers/ProvenanceProvider";

type CodeEditorProps = {
    setOutputCallback: any,
    data: any,
    output: {code: string, content: string},
    boxType: BoxType,
    replacedCode: string, // code with all marks resolved
    sendCodeToWidgets: any,
    replacedCodeDirty: boolean,
    readOnly: boolean,
    defaultValue?: any,
    floatCode?: any,
}

function CodeEditor({ setOutputCallback, data, output, boxType, replacedCode, sendCodeToWidgets, replacedCodeDirty, readOnly, defaultValue, floatCode}: CodeEditorProps) {
    const [code, setCode] = useState<string>(""); // code with all original markers

    const { workflowNameRef } = useFlowContext();
    const { boxExecProv } = useProvenanceContext();

    const replacedCodeDirtyBypass = useRef(false);
    const defaultValueBypass = useRef(false);

    const handleCodeChange = (value, event) => {
        setCode(value);
    };

	useEffect(() => {
        if(defaultValue != undefined && defaultValueBypass.current){
            setCode(defaultValue);
            sendCodeToWidgets(defaultValue); // will resolve markers for templated boxes
        }

        defaultValueBypass.current = true;
	}, [defaultValue]);

    useEffect(() => {
        if(floatCode != undefined)
    		floatCode(code);
	}, [code]);

    const processExecutionResult = (result: any) => {
        
        let outputContent = result.output;

        let outputType = "";

        try {

            let parsed_output = JSON.parse(outputContent);

            let dataType = parsed_output.dataType;

            if(dataType == 'int' || dataType == 'str' || dataType == 'float' || dataType == 'bool')
                outputType = SupportedType.VALUE;
            else if(dataType == 'list')
                outputType = SupportedType.LIST;
            else if(dataType == 'dict')
                outputType = SupportedType.JSON;
            else if(dataType == 'dataframe')
                outputType = SupportedType.DATAFRAME;
            else if(dataType == 'geodataframe')
                outputType = SupportedType.GEODATAFRAME;
            else if(dataType == 'raster')
                outputType = SupportedType.RASTER;
            else if(dataType == 'outputs')
                outputType = "MULTIPLE";
        } catch (error) {
            console.error("Invalid output type", error);
        }

        if(outputContent.length > 100){
            outputContent = outputContent.slice(0,100)+"...";
        }

        setOutputCallback({code: "success", content: outputContent, outputType: outputType});

        if (result.stderr == "") { // No error in the execution
            data.outputCallback(data.nodeId, result.output);
        } else {
            setOutputCallback({code: "error", content: result.stderr, outputType: outputType});
        }
    };

    // marks were resolved and new code is available
    useEffect(() => {

        if(replacedCode != "" && replacedCodeDirtyBypass.current && output.code == "exec"){ // the code was executing and not only resolving widgets
            data.pythonInterpreter.interpretCode(
                code,
                replacedCode,
                data.input,
                processExecutionResult,
                boxType,
                data.nodeId,
                workflowNameRef.current,
                boxExecProv
            );
        }

        replacedCodeDirtyBypass.current = true;

    }, [replacedCodeDirty]);

    useEffect(() => {
        // Save a reference to the original ResizeObserver
        const OriginalResizeObserver = window.ResizeObserver;

        // @ts-ignore
        window.ResizeObserver = function (callback) {
        const wrappedCallback = (entries: any, observer: any) => {
            window.requestAnimationFrame(() => {
            callback(entries, observer);
            });
        };

        // Create an instance of the original ResizeObserver
        // with the wrapped callback
        return new OriginalResizeObserver(wrappedCallback);
        };

        // Copy over static methods, if any
        for (let staticMethod in OriginalResizeObserver) {
        if (OriginalResizeObserver.hasOwnProperty(staticMethod)) {
            // @ts-ignore
            window.ResizeObserver[staticMethod] = OriginalResizeObserver[staticMethod];
        }
        }
    }, [])

    return (
        <div className={"nowheel nodrag"} style={{height: "100%"}}>
            <Editor
                language="python"
                theme="vs-dark"
                value={code}
                onChange={handleCodeChange}
                options={{
                    inlineSuggest: true,
                    fontSize: 8,
                    formatOnType: true,
                    autoClosingBrackets: true,
                    minimap: { enabled: false },
                    readOnly: readOnly
                }}
            />
            {/* <div
                className="nowheel"
                style={{ width: "100%", maxHeight: "200px", overflowY: "scroll" }}
            >
                {output == "success" ? "Done" : output == "exec" ? "Executing..." : output != "" ? "Error: "+output : ""}
            </div> */}
            {/* <Button
                as="a"
                variant="primary"
                onClick={() => {
                    setOutputCallback("exec");
                    sendCodeToWidgets(code); // will resolve markers
                }}
            >
                Run code
          </Button> */}
        </div>
    );
}

export default CodeEditor;
