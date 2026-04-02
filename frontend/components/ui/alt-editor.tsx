/*ts-nocheck*/



class EditableBlock extends React.Component {
    constructor(props) {
        super(props);
        // ...
        this.onKeyUpHandler = this.onKeyUpHandler.bind(this);
        this.openSelectMenuHandler = this.openSelectMenuHandler.bind(this);
        this.closeSelectMenuHandler = this.closeSelectMenuHandler.bind(this);
        this.tagSelectionHandler = this.tagSelectionHandler.bind(this);
        this.contentEditable = React.createRef();
        this.state = {
            htmlBackup: null,
            html: "",
            tag: "p",
            previousKey: "",
            selectMenuIsOpen: false,
            selectMenuPosition: {
                x: null,
                y: null
            }
        };
    }

    // ...

    onKeyUpHandler(e) {
        if (e.key === "/") {
            this.openSelectMenuHandler();
        }
    }

    openSelectMenuHandler() {
        const { x, y } = getCaretCoordinates();
        this.setState({
            selectMenuIsOpen: true,
            selectMenuPosition: { x, y }
        });
        document.addEventListener("click", this.closeSelectMenuHandler);
    }

    closeSelectMenuHandler() {
        this.setState({
            htmlBackup: null,
            selectMenuIsOpen: false,
            selectMenuPosition: { x: null, y: null }
        });
        document.removeEventListener("click", this.closeSelectMenuHandler);
    }

    tagSelectionHandler(tag) {
        this.setState({ tag: tag, html: this.state.htmlBackup }, () => {
            setCaretToEnd(this.contentEditable.current);
            this.closeSelectMenuHandler();
        });
    }

    render() {
        return (
            <>
                {this.state.selectMenuIsOpen && (
                    <SelectMenu
                        position={this.state.selectMenuPosition}
                        onSelect={this.tagSelectionHandler}
                        close={this.closeSelectMenuHandler}
                    />
                )}
                <ContentEditable
                    className="Block"
                    innerRef={this.contentEditable}
                    html={this.state.html}
                    tagName={this.state.tag}
                    onChange={this.onChangeHandler}
                    onKeyDown={this.onKeyDownHandler}
                    onKeyUp={this.onKeyUpHandler}
                />
            </>
        );
    }
}

export default EditableBlock;

// Imports

const MENU_HEIGHT = 150;
const allowedTags = [
    {
        id: "page-title",
        tag: "h1",
        label: "Page Title"
    },
    {
        id: "heading",
        tag: "h2",
        label: "Heading"
    },
    {
        id: "subheading",
        tag: "h3",
        label: "Subheading"
    },
    {
        id: "paragraph",
        tag: "p",
        label: "Paragraph"
    }
];

class SelectMenu extends React.Component {
    constructor(props) {
        super(props);
        this.keyDownHandler = this.keyDownHandler.bind(this);
        this.state = {
            command: "",
            items: allowedTags,
            selectedItem: 0
        };
    }

    componentDidMount() {
        document.addEventListener("keydown", this.keyDownHandler);
    }

    componentDidUpdate(prevProps, prevState) {
        const command = this.state.command;
        if (prevState.command !== command) {
            const items = matchSorter(allowedTags, command, { keys: ["tag"] });
            this.setState({ items: items });
        }
    }

    componentWillUnmount() {
        document.removeEventListener("keydown", this.keyDownHandler);
    }

    keyDownHandler(e) {
        const items = this.state.items;
        const selected = this.state.selectedItem;
        const command = this.state.command;

        switch (e.key) {
            case "Enter":
                e.preventDefault();
                this.props.onSelect(items[selected].tag);
                break;
            case "Backspace":
                if (!command) this.props.close();
                this.setState({ command: command.substring(0, command.length - 1) });
                break;
            case "ArrowUp":
                e.preventDefault();
                const prevSelected = selected === 0 ? items.length - 1 : selected - 1;
                this.setState({ selectedItem: prevSelected });
                break;
            case "ArrowDown":
            case "Tab":
                e.preventDefault();
                const nextSelected = selected === items.length - 1 ? 0 : selected + 1;
                this.setState({ selectedItem: nextSelected });
                break;
            default:
                this.setState({ command: this.state.command + e.key });
                break;
        }
    }

    render() {
        const x = this.props.position.x;
        const y = this.props.position.y - MENU_HEIGHT;
        const positionAttributes = { top: y, left: x };

        return (
            <div className="SelectMenu" style={positionAttributes}>
                <div className="Items">
                    {this.state.items.map((item, key) => {
                        const selectedItem = this.state.selectedItem;
                        const isSelected = this.state.items.indexOf(item) === selectedItem;
                        return (
                            <div
                                className={isSelected ? "Selected" : null}
                                key={key}
                                role="button"
                                tabIndex="0"
                                onClick={() => this.props.onSelect(item.tag)}
                            >
                                {item.label}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
}

export default SelectMenu;

import React from "react";

import "./styles.css";
import EditableBlock from "./editableBlock";

import uid from "./utils/uid";
import { setCaretToEnd } from "./utils/caretHelpers";

const initialBlock = { id: uid(), html: "", tag: "p" };

class EditablePage extends React.Component {
    constructor(props) {
        super(props);
        this.updatePageHandler = this.updatePageHandler.bind(this);
        this.addBlockHandler = this.addBlockHandler.bind(this);
        this.deleteBlockHandler = this.deleteBlockHandler.bind(this);
        this.state = { blocks: [initialBlock] };
    }

    updatePageHandler(updatedBlock) {
        const blocks = this.state.blocks;
        const index = blocks.map((b) => b.id).indexOf(updatedBlock.id);
        const updatedBlocks = [...blocks];
        updatedBlocks[index] = {
            ...updatedBlocks[index],
            tag: updatedBlock.tag,
            html: updatedBlock.html
        };
        this.setState({ blocks: updatedBlocks });
    }

    addBlockHandler(currentBlock) {
        const newBlock = { id: uid(), html: "", tag: "p" };
        const blocks = this.state.blocks;
        const index = blocks.map((b) => b.id).indexOf(currentBlock.id);
        const updatedBlocks = [...blocks];
        updatedBlocks.splice(index + 1, 0, newBlock);
        this.setState({ blocks: updatedBlocks }, () => {
            currentBlock.ref.nextElementSibling.focus();
        });
    }

    deleteBlockHandler(currentBlock) {
        // Only delete the block, if there is a preceding one
        const previousBlock = currentBlock.ref.previousElementSibling;
        if (previousBlock) {
            const blocks = this.state.blocks;
            const index = blocks.map((b) => b.id).indexOf(currentBlock.id);
            const updatedBlocks = [...blocks];
            updatedBlocks.splice(index, 1);
            this.setState({ blocks: updatedBlocks }, () => {
                setCaretToEnd(previousBlock);
                previousBlock.focus();
            });
        }
    }

    render() {
        return (
            <div className="Page">
                {this.state.blocks.map((block, key) => {
                    return (
                        <EditableBlock
                            key={key}
                            id={block.id}
                            tag={block.tag}
                            html={block.html}
                            updatePage={this.updatePageHandler}
                            addBlock={this.addBlockHandler}
                            deleteBlock={this.deleteBlockHandler}
                        />
                    );
                })}
            </div>
        );
    }
}

export default EditablePage;