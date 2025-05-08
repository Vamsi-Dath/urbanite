import React, {
    createContext,
    useContext,
    ReactNode,
    useState,
    useEffect
} from "react";
import { LLMEvents, LLMEventStatus } from "../constants";

interface LLMContextProps {
    openAIRequest: (preamble_file: string, prompt_file: string, text: string, chatId?: string) => any;
    addNewEvent: (event: {type: LLMEvents,  status: LLMEventStatus, data?: any}) => void;
    consumeEvent: (newEvent?: {type: LLMEvents, status: LLMEventStatus, data?: any}) => void;
    setCurrentEventPipeline: (eventName: string) => void;
    currentEventPipeline: string;
    llmEvents: {type: LLMEvents, status: LLMEventStatus, data?: any}[];
}

export const LLMContext = createContext<LLMContextProps>({
    openAIRequest: () => {},
    addNewEvent: () => {},
    consumeEvent: () => {},
    setCurrentEventPipeline: () => {},
    currentEventPipeline: "",
    llmEvents: []
});

const LLMProvider = ({ children }: { children: ReactNode }) => {

    const [llmEvents, setLLMEvents] = useState<{type: LLMEvents, status: LLMEventStatus, data?: any}[]>([]); // Events are consumed starting from index 0

    const [currentEventPipeline, setCurrentEventPipeline] = useState("");

    useEffect(() => {
        console.log("llmEvents", llmEvents);
    }, [llmEvents]);

    const addNewEvent = (event: {type: LLMEvents, status: LLMEventStatus, data?: any}) => {
        // setLLMEvents((prevEvents: {type: LLMEvents, status: LLMEventStatus, data?: any}[]) => { // Overwrite previous events
        //     return [event];
        // });
    };

    const consumeEvent = (newEvent?: {type: LLMEvents, status: LLMEventStatus,  data?: any}) => {
        if(llmEvents.length == 0){
            throw new Error("No LLM Events to consume");
        }

        setLLMEvents((prevEvents: {type: LLMEvents, status: LLMEventStatus, data?: any}[]) => {

            if(newEvent != undefined)
                return [newEvent, ...prevEvents.slice(1)];
            else
                return prevEvents.slice(1);

        });
    }

    const openAIRequest = async (preamble_file: string, prompt_file: string, text: string, chatId?: string) => {

        let message: any = {preamble: preamble_file, prompt: prompt_file, text: text};

        if(chatId)
            message.chatId = chatId;

        const response_usage = await fetch(`${process.env.BACKEND_URL}/checkUsageOpenAI`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
        });

        if (!response_usage.ok) {
            throw new Error("Failed to submit data.");
        }

        const result_usage = await response_usage.json();

        if(result_usage.result != "yes") // There is no token left, have to wait
            await new Promise(resolve => setTimeout(resolve, (result_usage.result + 15) * 1000)); // add a 15 seconds margin

        console.log("message", {...message});

        const response = await fetch(`${process.env.BACKEND_URL}/openAI`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
        });
    
        if (!response.ok) {
            throw new Error("Failed to submit data.");
        }

        const result = await response.json();
        return result;
    }

    return (
        <LLMContext.Provider
            value={{
                openAIRequest,
                addNewEvent,
                consumeEvent,
                setCurrentEventPipeline,
                currentEventPipeline,
                llmEvents
            }}
        >
            {children}
        </LLMContext.Provider>
    );
};

export const useLLMContext = () => {
    const context = useContext(LLMContext);

    if (!context) {
        throw new Error("useLLMContext must be used within a LLMProvider");
    }

    return context;
};

export default LLMProvider;
